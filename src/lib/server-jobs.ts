// Client-side service for server-side job management
// Allows queuing jobs that run independently of browser sessions

export interface ServerJob {
  id: string;
  type: 'bulk_add_tags' | 'bulk_remove_tags';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
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

export interface ServerJobStats {
  activeJobs: number;
  maxConcurrentJobs: number;
  availableSlots: number;
}

class ServerJobsService {
  private baseURL: string;

  constructor() {
    this.baseURL = window.location.origin;
  }

  private async apiRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
    const url = `${this.baseURL}/api${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader()
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  private getAuthHeader(): string {
    // Use the same authentication as the worker expects
    // The worker expects Basic auth with admin123:admin123
    return `Basic ${btoa('admin123:admin123')}`;
  }

  /**
   * Queue a server-side bulk tagging job
   */
  async queueBulkTagJob(
    type: 'bulk_add_tags' | 'bulk_remove_tags',
    segmentId: number,
    segmentName: string,
    tags: string[]
  ): Promise<{ success: boolean; jobId: string; message: string }> {
    return await this.apiRequest('/server-jobs', 'POST', {
      type,
      segmentId,
      segmentName,
      tags
    });
  }

  /**
   * Get all server jobs for the current user
   */
  async getAllJobs(): Promise<ServerJob[]> {
    return await this.apiRequest('/server-jobs');
  }

  /**
   * Trigger job processing for the current user
   */
  async triggerJobProcessing(): Promise<{ success: boolean; message: string; stats: ServerJobStats }> {
    return await this.apiRequest('/server-jobs/process', 'POST');
  }

  /**
   * Cancel a queued or running job
   */
  async cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return await this.apiRequest(`/server-jobs/${jobId}/cancel`, 'POST');
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId: string): Promise<ServerJob | null> {
    const jobs = await this.getAllJobs();
    return jobs.find(job => job.id === jobId) || null;
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: ServerJob['status']): Promise<ServerJob[]> {
    const jobs = await this.getAllJobs();
    return jobs.filter(job => job.status === status);
  }

  /**
   * Get active (running or queued) jobs
   */
  async getActiveJobs(): Promise<ServerJob[]> {
    const jobs = await this.getAllJobs();
    return jobs.filter(job => job.status === 'running' || job.status === 'queued');
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(): Promise<ServerJob[]> {
    const jobs = await this.getAllJobs();
    return jobs.filter(job => job.status === 'completed' || job.status === 'failed');
  }

  /**
   * Check if server-side processing is available
   */
  async isServerProcessingAvailable(): Promise<boolean> {
    try {
      await this.apiRequest('/server-jobs');
      return true;
    } catch (error) {
      console.warn('Server-side processing not available:', error);
      return false;
    }
  }

  /**
   * Get job duration in human-readable format
   */
  getJobDuration(job: ServerJob): string {
    const start = new Date(job.startTime);
    const end = job.endTime ? new Date(job.endTime) : new Date();
    const duration = end.getTime() - start.getTime();

    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get job progress percentage
   */
  getJobProgress(job: ServerJob): number {
    if (job.progress.total === 0) return 0;
    return Math.round((job.progress.current / job.progress.total) * 100);
  }

  /**
   * Get estimated time remaining for a job
   */
  getEstimatedTimeRemaining(job: ServerJob): string {
    if (job.status !== 'running' || job.progress.total === 0 || job.progress.current === 0) {
      return 'Unknown';
    }

    const elapsed = new Date().getTime() - new Date(job.startTime).getTime();
    const rate = job.progress.current / elapsed; // customers per millisecond
    const remaining = job.progress.total - job.progress.current;
    const estimatedMs = remaining / rate;

    const minutes = Math.floor(estimatedMs / 60000);
    const seconds = Math.floor((estimatedMs % 60000) / 1000);

    if (minutes > 0) {
      return `~${minutes}m ${seconds}s`;
    } else {
      return `~${seconds}s`;
    }
  }

  /**
   * Format job status for display
   */
  formatJobStatus(status: ServerJob['status']): { text: string; color: string } {
    switch (status) {
      case 'queued':
        return { text: 'Queued', color: 'blue' };
      case 'running':
        return { text: 'Running', color: 'green' };
      case 'completed':
        return { text: 'Completed', color: 'green' };
      case 'failed':
        return { text: 'Failed', color: 'red' };
      case 'paused':
        return { text: 'Paused', color: 'yellow' };
      case 'cancelled':
        return { text: 'Cancelled', color: 'gray' };
      default:
        return { text: status, color: 'gray' };
    }
  }
}

// Export singleton instance
export const serverJobsService = new ServerJobsService(); 