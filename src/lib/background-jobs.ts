export interface BackgroundJob {
  id: string;
  type: 'bulk_add_tags' | 'bulk_remove_tags';
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  segmentId: number;
  segmentName: string;
  tags: string[];
  progress: {
    current: number;
    total: number;
    skipped: number;
    message: string;
  };
  // Enhanced checkpoint system
  checkpoint?: {
    lastProcessedCustomerId?: string;
    processedCustomerIds: string[];
    batchIndex: number;
    lastSaveTime: string;
  };
  result?: {
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  };
  startTime: string;
  endTime?: string;
  lastUpdate: string;
  isCancelled?: boolean; // Flag to signal cancellation to running operations
  // Enhanced timeout and retry settings
  settings?: {
    batchSize: number;
    saveInterval: number; // Save checkpoint every N customers
    maxRetries: number;
    timeoutMinutes: number;
  };
}

class BackgroundJobsService {
  private static readonly STORAGE_KEY = 'bulk_tagger_background_jobs';
  private static readonly MAX_JOBS = 10; // Keep last 10 jobs
  private jobs: Map<string, BackgroundJob> = new Map();
  private activeJobId: string | null = null;
  private progressCallbacks: Map<string, (job: BackgroundJob) => void> = new Map();
  private cancellationSignals: Map<string, boolean> = new Map(); // Track cancellation signals

  constructor() {
    this.loadJobsFromStorage();
    this.resumeActiveJob();
  }

  /**
   * Start a new background job
   */
  startJob(
    type: 'bulk_add_tags' | 'bulk_remove_tags',
    segmentId: number,
    segmentName: string,
    tags: string[],
    settings?: {
      batchSize?: number;
      saveInterval?: number;
      maxRetries?: number;
      timeoutMinutes?: number;
    }
  ): string {
    const jobId = this.generateJobId();
    const job: BackgroundJob = {
      id: jobId,
      type,
      status: 'running',
      segmentId,
      segmentName,
      tags,
      progress: {
        current: 0,
        total: 0,
        skipped: 0,
        message: 'Initializing...'
      },
      checkpoint: {
        processedCustomerIds: [],
        batchIndex: 0,
        lastSaveTime: new Date().toISOString()
      },
      settings: {
        batchSize: settings?.batchSize || 10,
        saveInterval: settings?.saveInterval || 50, // Save every 50 customers
        maxRetries: settings?.maxRetries || 3,
        timeoutMinutes: settings?.timeoutMinutes || 30
      },
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    this.activeJobId = jobId;
    this.saveJobsToStorage();

    console.log(`🚀 Started background job ${jobId}:`, {
      type: job.type,
      segment: job.segmentName,
      tags: job.tags,
      settings: job.settings
    });

    return jobId;
  }

  /**
   * Update job progress
   */
  updateJobProgress(
    jobId: string,
    current: number,
    total: number,
    skipped: number,
    message: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = { current, total, skipped, message };
    job.lastUpdate = new Date().toISOString();
    
    this.jobs.set(jobId, job);
    this.saveJobsToStorage();

    // Notify progress callback
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }
  }

  /**
   * Complete a job
   */
  completeJob(
    jobId: string,
    result: {
      success: boolean;
      processedCount: number;
      skippedCount: number;
      errors: string[];
    }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Clear cancellation signal
    this.clearCancellationSignal(jobId);

    job.status = result.success ? 'completed' : 'failed';
    job.result = result;
    job.endTime = new Date().toISOString();
    job.lastUpdate = new Date().toISOString();

    this.jobs.set(jobId, job);
    this.activeJobId = null;
    this.saveJobsToStorage();

    console.log(`✅ Completed background job ${jobId}:`, {
      success: result.success,
      processed: result.processedCount,
      skipped: result.skippedCount,
      errors: result.errors.length,
      duration: this.getJobDuration(job)
    });

    // Notify progress callback
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }
  }

  /**
   * Get a specific job
   */
  getJob(jobId: string): BackgroundJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * Get the currently active job
   */
  getActiveJob(): BackgroundJob | null {
    if (!this.activeJobId) return null;
    return this.jobs.get(this.activeJobId) || null;
  }

  /**
   * Check if there's an active job
   */
  hasActiveJob(): boolean {
    return this.activeJobId !== null && this.jobs.has(this.activeJobId);
  }

  /**
   * Subscribe to job progress updates
   */
  subscribeToJob(jobId: string, callback: (job: BackgroundJob) => void): void {
    this.progressCallbacks.set(jobId, callback);
  }

  /**
   * Unsubscribe from job progress updates
   */
  unsubscribeFromJob(jobId: string): void {
    this.progressCallbacks.delete(jobId);
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== 'running' && job.status !== 'paused')) return;

    // Set cancellation signal
    this.cancellationSignals.set(jobId, true);
    
    // Update job status
    job.status = 'cancelled';
    job.isCancelled = true;
    job.endTime = new Date().toISOString();
    job.lastUpdate = new Date().toISOString();
    
    // Set result if not already set
    if (!job.result) {
      job.result = {
        success: false,
        processedCount: job.progress.current,
        skippedCount: job.progress.skipped,
        errors: ['Operation cancelled by user']
      };
    }
    
    this.jobs.set(jobId, job);
    if (this.activeJobId === jobId) {
      this.activeJobId = null;
    }
    this.saveJobsToStorage();

    // Notify progress callback
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }
  }

  /**
   * Check if a job has been cancelled
   */
  isJobCancelled(jobId: string): boolean {
    return this.cancellationSignals.get(jobId) === true;
  }

  /**
   * Clear cancellation signal (used when job completes)
   */
  clearCancellationSignal(jobId: string): void {
    this.cancellationSignals.delete(jobId);
  }

  /**
   * Force stop a job (immediate termination)
   */
  forceStopJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Set cancellation signal
    this.cancellationSignals.set(jobId, true);
    
    // Immediately mark as cancelled
    job.status = 'cancelled';
    job.isCancelled = true;
    job.endTime = new Date().toISOString();
    job.lastUpdate = new Date().toISOString();
    job.progress.message = 'Operation stopped by user';
    
    if (!job.result) {
      job.result = {
        success: false,
        processedCount: job.progress.current,
        skippedCount: job.progress.skipped,
        errors: ['Operation forcefully stopped by user']
      };
    }
    
    this.jobs.set(jobId, job);
    if (this.activeJobId === jobId) {
      this.activeJobId = null;
    }
    this.saveJobsToStorage();

    // Notify progress callback
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(): void {
    const activeJob = this.getActiveJob();
    this.jobs.clear();
    
    if (activeJob) {
      this.jobs.set(activeJob.id, activeJob);
    }
    
    this.saveJobsToStorage();
  }

  /**
   * Get job duration
   */
  getJobDuration(job: BackgroundJob): string {
    const start = new Date(job.startTime);
    const end = job.endTime ? new Date(job.endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load jobs from localStorage
   */
  private loadJobsFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('localStorage not available, jobs will not persist');
        return;
      }
      
      const stored = localStorage.getItem(BackgroundJobsService.STORAGE_KEY);
      if (stored) {
        const jobsArray: BackgroundJob[] = JSON.parse(stored);
        this.jobs.clear();
        jobsArray.forEach(job => this.jobs.set(job.id, job));
        
        // Find active job
        const activeJob = jobsArray.find(job => job.status === 'running');
        this.activeJobId = activeJob?.id || null;
        
        if (activeJob) {
          console.log('🔄 Restored active job from storage:', activeJob.id, activeJob.type);
        }
        
        console.log(`📦 Loaded ${jobsArray.length} background jobs from storage`);
      }
    } catch (error) {
      console.error('Failed to load background jobs from storage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem(BackgroundJobsService.STORAGE_KEY);
        console.log('🧹 Cleared corrupted background jobs storage');
      } catch (removeError) {
        console.error('Failed to clear corrupted storage:', removeError);
      }
    }
  }

  /**
   * Save jobs to localStorage
   */
  private saveJobsToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('localStorage not available, cannot save jobs');
        return;
      }
      
      const jobsArray = Array.from(this.jobs.values());
      
      // Keep only the most recent jobs
      const sortedJobs = jobsArray
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, BackgroundJobsService.MAX_JOBS);
      
      localStorage.setItem(BackgroundJobsService.STORAGE_KEY, JSON.stringify(sortedJobs));
      console.log(`💾 Saved ${sortedJobs.length} background jobs to storage`);
    } catch (error) {
      console.error('Failed to save background jobs to storage:', error);
    }
  }

  /**
   * Resume active job after page reload
   */
  private resumeActiveJob(): void {
    const activeJob = this.getActiveJob();
    if (activeJob && activeJob.status === 'running') {
      // Check if job has completely timed out
      if (this.hasJobTimedOut(activeJob.id)) {
        // Mark as failed due to complete timeout
        this.completeJob(activeJob.id, {
          success: false,
          processedCount: activeJob.progress.current,
          skippedCount: activeJob.progress.skipped,
          errors: [`Job timed out after ${activeJob.settings?.timeoutMinutes || 30} minutes`]
        });
        return;
      }

      // Check if job needs resumption (stale but not completely timed out)
      if (this.needsResumption(activeJob.id)) {
        console.log(`🔄 Job ${activeJob.id} needs resumption after page reload`);
        // Job will be resumed by the Dashboard component
      }
    }
  }

  /**
   * Resume a job that was interrupted (e.g., by page reload)
   */
  async resumeJob(jobId: string, shopifyAPI: any): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return;

    // Update job status to indicate resumption
    this.updateJobProgress(jobId, job.progress.current, job.progress.total, job.progress.skipped, 'Resuming job...');

    try {
      let result;
      if (job.type === 'bulk_add_tags') {
        result = await shopifyAPI.bulkAddTagsToSegment(
          job.segmentId,
          job.tags,
          (current: number, total: number, skipped: number, message: string) => {
            this.updateJobProgress(jobId, current, total, skipped, message);
          }
        );
      } else {
        result = await shopifyAPI.bulkRemoveTagsFromSegment(
          job.segmentId,
          job.tags,
          (current: number, total: number, skipped: number, message: string) => {
            this.updateJobProgress(jobId, current, total, skipped, message);
          }
        );
      }

      // Complete the job
      this.completeJob(jobId, result);
    } catch (error) {
      // Complete the job with error
      this.completeJob(jobId, {
        success: false,
        processedCount: job.progress.current,
        skippedCount: job.progress.skipped,
        errors: [error instanceof Error ? error.message : 'Unknown error during job resumption']
      });
    }
  }

  /**
   * Check if a job needs to be resumed
   */
  needsResumption(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;

    const lastUpdate = new Date(job.lastUpdate);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Use job-specific timeout or default to 5 minutes
    const timeoutMinutes = job.settings?.timeoutMinutes || 5;
    
    return timeDiffMinutes > Math.min(timeoutMinutes, 5); // Cap at 5 minutes for safety
  }

  /**
   * Pause a running job
   */
  pauseJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return;

    // Set cancellation signal to stop current processing
    this.cancellationSignals.set(jobId, true);
    
    // Update job status to paused
    job.status = 'paused';
    job.lastUpdate = new Date().toISOString();
    job.progress.message = 'Operation paused by user';
    
    this.jobs.set(jobId, job);
    if (this.activeJobId === jobId) {
      this.activeJobId = null;
    }
    this.saveJobsToStorage();

    // Notify progress callback
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }
  }

  /**
   * Resume a paused job
   */
  async resumePausedJob(jobId: string, shopifyAPI: any): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') return;

    // Clear any existing cancellation signal
    this.clearCancellationSignal(jobId);
    
    // Update job status to running
    job.status = 'running';
    job.lastUpdate = new Date().toISOString();
    job.progress.message = 'Resuming operation...';
    
    this.jobs.set(jobId, job);
    this.activeJobId = jobId;
    this.saveJobsToStorage();

    // Notify progress callback
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }

    try {
      let result;
      if (job.type === 'bulk_add_tags') {
        result = await shopifyAPI.bulkAddTagsToSegment(
          job.segmentId,
          job.tags,
          (current: number, total: number, skipped: number, message: string) => {
            this.updateJobProgress(jobId, current, total, skipped, message);
          },
          () => this.isJobCancelled(jobId) // Cancellation checker
        );
      } else {
        result = await shopifyAPI.bulkRemoveTagsFromSegment(
          job.segmentId,
          job.tags,
          (current: number, total: number, skipped: number, message: string) => {
            this.updateJobProgress(jobId, current, total, skipped, message);
          },
          () => this.isJobCancelled(jobId) // Cancellation checker
        );
      }

      // Complete the job
      this.completeJob(jobId, result);
    } catch (error) {
      // Complete the job with error
      this.completeJob(jobId, {
        success: false,
        processedCount: job.progress.current,
        skippedCount: job.progress.skipped,
        errors: [error instanceof Error ? error.message : 'Unknown error during job resumption']
      });
    }
  }

  /**
   * Save checkpoint for a job
   */
  saveCheckpoint(
    jobId: string, 
    lastProcessedCustomerId: string, 
    processedCustomerIds: string[], 
    batchIndex: number
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.checkpoint = {
      lastProcessedCustomerId,
      processedCustomerIds: [...processedCustomerIds], // Create a copy
      batchIndex,
      lastSaveTime: new Date().toISOString()
    };
    
    job.lastUpdate = new Date().toISOString();
    this.jobs.set(jobId, job);
    this.saveJobsToStorage();
    
    console.log(`💾 Checkpoint saved for job ${jobId}: ${processedCustomerIds.length} customers processed`);
  }

  /**
   * Check if job should save checkpoint based on interval
   */
  shouldSaveCheckpoint(jobId: string, currentCount: number): boolean {
    const job = this.jobs.get(jobId);
    if (!job || !job.settings) return false;
    
    return currentCount % job.settings.saveInterval === 0;
  }

  /**
   * Get customers that still need processing (for resumption)
   */
  getRemainingCustomers(jobId: string, allCustomerIds: string[]): string[] {
    const job = this.jobs.get(jobId);
    if (!job || !job.checkpoint) return allCustomerIds;
    
    const processedIds = new Set(job.checkpoint.processedCustomerIds);
    return allCustomerIds.filter(id => !processedIds.has(id));
  }

  /**
   * Check if job has timed out completely
   */
  hasJobTimedOut(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;

    const startTime = new Date(job.startTime);
    const now = new Date();
    const totalMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
    
    const maxMinutes = job.settings?.timeoutMinutes || 30;
    return totalMinutes > maxMinutes;
  }

  /**
   * Get job statistics for monitoring
   */
  getJobStats(jobId: string): {
    duration: string;
    rate: number; // customers per minute
    eta: string; // estimated time remaining
    checkpointAge: string;
  } | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const startTime = new Date(job.startTime);
    const now = new Date();
    const durationMs = now.getTime() - startTime.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    
    const rate = durationMinutes > 0 ? job.progress.current / durationMinutes : 0;
    const remaining = job.progress.total - job.progress.current;
    const etaMinutes = rate > 0 ? remaining / rate : 0;
    
    const checkpointTime = job.checkpoint?.lastSaveTime ? new Date(job.checkpoint.lastSaveTime) : startTime;
    const checkpointAge = Math.floor((now.getTime() - checkpointTime.getTime()) / (1000 * 60));
    
    return {
      duration: this.formatDuration(durationMs),
      rate: Math.round(rate * 10) / 10,
      eta: etaMinutes > 0 ? this.formatDuration(etaMinutes * 60 * 1000) : 'Unknown',
      checkpointAge: `${checkpointAge}m ago`
    };
  }

  /**
   * Format duration in a human-readable way
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export singleton instance
export const backgroundJobsService = new BackgroundJobsService(); 