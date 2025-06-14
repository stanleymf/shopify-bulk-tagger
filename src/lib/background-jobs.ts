export interface BackgroundJob {
  id: string;
  type: 'bulk_add_tags' | 'bulk_remove_tags';
  status: 'running' | 'completed' | 'failed' | 'paused';
  segmentId: number;
  segmentName: string;
  tags: string[];
  progress: {
    current: number;
    total: number;
    skipped: number;
    message: string;
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
}

class BackgroundJobsService {
  private static readonly STORAGE_KEY = 'bulk_tagger_background_jobs';
  private static readonly MAX_JOBS = 10; // Keep last 10 jobs
  private jobs: Map<string, BackgroundJob> = new Map();
  private activeJobId: string | null = null;
  private progressCallbacks: Map<string, (job: BackgroundJob) => void> = new Map();

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
    tags: string[]
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
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    this.activeJobId = jobId;
    this.saveJobsToStorage();

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

    job.status = result.success ? 'completed' : 'failed';
    job.result = result;
    job.endTime = new Date().toISOString();
    job.lastUpdate = new Date().toISOString();

    this.jobs.set(jobId, job);
    this.activeJobId = null;
    this.saveJobsToStorage();

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
    if (!job || job.status !== 'running') return;

    job.status = 'paused';
    job.lastUpdate = new Date().toISOString();
    
    this.jobs.set(jobId, job);
    if (this.activeJobId === jobId) {
      this.activeJobId = null;
    }
    this.saveJobsToStorage();
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
      const stored = localStorage.getItem(BackgroundJobsService.STORAGE_KEY);
      if (stored) {
        const jobsArray: BackgroundJob[] = JSON.parse(stored);
        this.jobs.clear();
        jobsArray.forEach(job => this.jobs.set(job.id, job));
        
        // Find active job
        const activeJob = jobsArray.find(job => job.status === 'running');
        this.activeJobId = activeJob?.id || null;
      }
    } catch (error) {
      console.error('Failed to load background jobs from storage:', error);
    }
  }

  /**
   * Save jobs to localStorage
   */
  private saveJobsToStorage(): void {
    try {
      const jobsArray = Array.from(this.jobs.values());
      
      // Keep only the most recent jobs
      const sortedJobs = jobsArray
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, BackgroundJobsService.MAX_JOBS);
      
      localStorage.setItem(BackgroundJobsService.STORAGE_KEY, JSON.stringify(sortedJobs));
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
      // Check if job is stale (more than 5 minutes old without update)
      const lastUpdate = new Date(activeJob.lastUpdate);
      const now = new Date();
      const timeDiff = now.getTime() - lastUpdate.getTime();
      
      if (timeDiff > 5 * 60 * 1000) { // 5 minutes
        // Mark as failed due to timeout
        this.completeJob(activeJob.id, {
          success: false,
          processedCount: activeJob.progress.current,
          skippedCount: activeJob.progress.skipped,
          errors: ['Job timed out after page reload']
        });
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

    // Check if job is stale (more than 2 minutes old without update)
    const lastUpdate = new Date(job.lastUpdate);
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdate.getTime();
    
    return timeDiff > 2 * 60 * 1000; // 2 minutes
  }
}

// Export singleton instance
export const backgroundJobsService = new BackgroundJobsService(); 