// Scheduled Jobs Service
// Handles recurring bulk tagging operations at specified intervals or times

import { shopifyAPI } from './shopify-api';
import { backgroundJobsService } from './background-jobs';
import { storage } from './storage';

export interface ScheduledJob {
  id: string;
  name: string;
  isActive: boolean;
  segmentId: number;
  segmentName: string;
  operation: 'add' | 'remove';
  tags: string[];
  schedule: {
    type: 'interval' | 'daily' | 'weekly' | 'monthly';
    // For interval type
    intervalMinutes?: number;
    // For daily type
    dailyTime?: string; // HH:MM format
    // For weekly type
    weeklyDay?: number; // 0-6 (Sunday-Saturday)
    weeklyTime?: string; // HH:MM format
    // For monthly type
    monthlyDay?: number; // 1-31
    monthlyTime?: string; // HH:MM format
  };
  timezone: string; // e.g., 'America/New_York'
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
  executionCount: number;
  lastResult?: {
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
    jobId: string; // Reference to background job
  };
}

class ScheduledJobsService {
  private scheduledJobs: ScheduledJob[] = [];
  private timers: Map<string, number> = new Map();
  private readonly STORAGE_KEY = 'bulk_tagger_scheduled_jobs';

  constructor() {
    this.loadScheduledJobs();
    this.startScheduler();
  }

  // Load scheduled jobs from storage
  private loadScheduledJobs(): void {
    try {
      const appData = storage.getAppData();
      if (appData.scheduledJobs) {
        this.scheduledJobs = appData.scheduledJobs;
        console.log(`Loaded ${this.scheduledJobs.length} scheduled jobs`);
      }
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    }
  }

  // Save scheduled jobs to storage
  private saveScheduledJobs(): void {
    try {
      const appData = storage.getAppData();
      storage.saveAppData({
        ...appData,
        scheduledJobs: this.scheduledJobs,
      });
    } catch (error) {
      console.error('Failed to save scheduled jobs:', error);
    }
  }

  // Start the scheduler
  private startScheduler(): void {
    // Check for due jobs every minute
    setInterval(() => {
      this.checkAndExecuteDueJobs();
    }, 60000); // 60 seconds

    // Schedule all active jobs
    this.scheduleAllJobs();
    console.log('Scheduled jobs service started');
  }

  // Schedule all active jobs
  private scheduleAllJobs(): void {
    this.scheduledJobs.forEach(job => {
      if (job.isActive) {
        this.scheduleJob(job);
      }
    });
  }

  // Schedule a single job
  private scheduleJob(job: ScheduledJob): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(job.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const nextRunTime = this.calculateNextRunTime(job);
    if (!nextRunTime) {
      console.warn(`Could not calculate next run time for job: ${job.name}`);
      return;
    }

    // Update next run time
    job.nextRun = nextRunTime.toISOString();
    this.saveScheduledJobs();

    const delay = nextRunTime.getTime() - Date.now();
    if (delay <= 0) {
      // Job is due now
      this.executeScheduledJob(job);
      return;
    }

    // Schedule the job
    const timer = setTimeout(() => {
      this.executeScheduledJob(job);
    }, delay);

    this.timers.set(job.id, timer);
    console.log(`Scheduled job "${job.name}" to run at ${nextRunTime.toLocaleString()}`);
  }

  // Calculate next run time for a job
  private calculateNextRunTime(job: ScheduledJob): Date | null {
    const now = new Date();
    const schedule = job.schedule;

    switch (schedule.type) {
      case 'interval':
        if (!schedule.intervalMinutes) return null;
        const lastRun = job.lastRun ? new Date(job.lastRun) : now;
        return new Date(lastRun.getTime() + (schedule.intervalMinutes * 60 * 1000));

      case 'daily':
        if (!schedule.dailyTime) return null;
        const [dailyHour, dailyMinute] = schedule.dailyTime.split(':').map(Number);
        const dailyNext = new Date(now);
        dailyNext.setHours(dailyHour, dailyMinute, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (dailyNext <= now) {
          dailyNext.setDate(dailyNext.getDate() + 1);
        }
        return dailyNext;

      case 'weekly':
        if (schedule.weeklyDay === undefined || !schedule.weeklyTime) return null;
        const [weeklyHour, weeklyMinute] = schedule.weeklyTime.split(':').map(Number);
        const weeklyNext = new Date(now);
        
        // Calculate days until target day
        const currentDay = now.getDay();
        const targetDay = schedule.weeklyDay;
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        
        // If it's the same day, check if time has passed
        if (daysUntilTarget === 0) {
          weeklyNext.setHours(weeklyHour, weeklyMinute, 0, 0);
          if (weeklyNext <= now) {
            daysUntilTarget = 7; // Next week
          }
        }
        
        weeklyNext.setDate(weeklyNext.getDate() + daysUntilTarget);
        weeklyNext.setHours(weeklyHour, weeklyMinute, 0, 0);
        return weeklyNext;

      case 'monthly':
        if (!schedule.monthlyDay || !schedule.monthlyTime) return null;
        const [monthlyHour, monthlyMinute] = schedule.monthlyTime.split(':').map(Number);
        const monthlyNext = new Date(now);
        monthlyNext.setDate(schedule.monthlyDay);
        monthlyNext.setHours(monthlyHour, monthlyMinute, 0, 0);
        
        // If date has passed this month, schedule for next month
        if (monthlyNext <= now) {
          monthlyNext.setMonth(monthlyNext.getMonth() + 1);
        }
        return monthlyNext;

      default:
        return null;
    }
  }

  // Check and execute due jobs
  private checkAndExecuteDueJobs(): void {
    const now = new Date();
    
    this.scheduledJobs.forEach(job => {
      if (!job.isActive) return;
      
      const nextRun = job.nextRun ? new Date(job.nextRun) : null;
      if (nextRun && nextRun <= now) {
        this.executeScheduledJob(job);
      }
    });
  }

  // Execute a scheduled job
  private async executeScheduledJob(job: ScheduledJob): Promise<void> {
    try {
      console.log(`Executing scheduled job: ${job.name}`);

      if (!shopifyAPI.isInitialized()) {
        console.error(`Cannot execute job "${job.name}": Shopify API not initialized`);
        return;
      }

      // Update last run time
      job.lastRun = new Date().toISOString();
      job.executionCount++;

      // Start background job for the bulk operation
      const backgroundJobId = backgroundJobsService.startJob(
        job.operation === 'add' ? 'bulk_add_tags' : 'bulk_remove_tags',
        job.segmentId,
        job.segmentName,
        job.tags,
        {
          batchSize: 10,
          saveInterval: 50,
          maxRetries: 3,
          timeoutMinutes: 30
        }
      );

      // Execute the bulk operation
      let result;
      if (job.operation === 'add') {
        result = await shopifyAPI.bulkAddTagsToSegment(
          job.segmentId,
          job.tags,
          (current: number, total: number, skipped: number, message: string) => {
            backgroundJobsService.updateJobProgress(backgroundJobId, current, total, skipped, message);
          },
          () => backgroundJobsService.isJobCancelled(backgroundJobId)
        );
      } else {
        result = await shopifyAPI.bulkRemoveTagsFromSegment(
          job.segmentId,
          job.tags,
          (current: number, total: number, skipped: number, message: string) => {
            backgroundJobsService.updateJobProgress(backgroundJobId, current, total, skipped, message);
          },
          () => backgroundJobsService.isJobCancelled(backgroundJobId)
        );
      }

      // Complete the background job
      backgroundJobsService.completeJob(backgroundJobId, result);

      // Store result
      job.lastResult = {
        ...result,
        jobId: backgroundJobId
      };

      console.log(`Scheduled job "${job.name}" completed: ${result.processedCount} customers processed`);

    } catch (error) {
      console.error(`Failed to execute scheduled job "${job.name}":`, error);
      
      // Store error result
      job.lastResult = {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        jobId: ''
      };
    } finally {
      // Schedule next run
      this.scheduleJob(job);
      this.saveScheduledJobs();
    }
  }

  // Add a new scheduled job
  addScheduledJob(job: Omit<ScheduledJob, 'id' | 'createdAt' | 'executionCount'>): string {
    const newJob: ScheduledJob = {
      ...job,
      id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      executionCount: 0,
    };

    this.scheduledJobs.push(newJob);
    this.saveScheduledJobs();

    // Schedule the job if it's active
    if (newJob.isActive) {
      this.scheduleJob(newJob);
    }

    console.log(`Added scheduled job: ${newJob.name}`);
    return newJob.id;
  }

  // Update a scheduled job
  updateScheduledJob(jobId: string, updates: Partial<ScheduledJob>): boolean {
    const jobIndex = this.scheduledJobs.findIndex(job => job.id === jobId);
    if (jobIndex === -1) {
      return false;
    }

    const oldJob = this.scheduledJobs[jobIndex];
    this.scheduledJobs[jobIndex] = { ...oldJob, ...updates };
    
    // Clear old timer
    const existingTimer = this.timers.get(jobId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(jobId);
    }

    // Reschedule if active
    if (this.scheduledJobs[jobIndex].isActive) {
      this.scheduleJob(this.scheduledJobs[jobIndex]);
    }

    this.saveScheduledJobs();
    console.log(`Updated scheduled job: ${jobId}`);
    return true;
  }

  // Delete a scheduled job
  deleteScheduledJob(jobId: string): boolean {
    const initialLength = this.scheduledJobs.length;
    
    // Clear timer
    const existingTimer = this.timers.get(jobId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(jobId);
    }

    this.scheduledJobs = this.scheduledJobs.filter(job => job.id !== jobId);
    
    if (this.scheduledJobs.length < initialLength) {
      this.saveScheduledJobs();
      console.log(`Deleted scheduled job: ${jobId}`);
      return true;
    }
    
    return false;
  }

  // Get all scheduled jobs
  getScheduledJobs(): ScheduledJob[] {
    return [...this.scheduledJobs];
  }

  // Get a specific scheduled job
  getScheduledJob(jobId: string): ScheduledJob | null {
    return this.scheduledJobs.find(job => job.id === jobId) || null;
  }

  // Toggle job active status
  toggleScheduledJob(jobId: string): boolean {
    const job = this.scheduledJobs.find(job => job.id === jobId);
    if (!job) return false;

    job.isActive = !job.isActive;

    if (job.isActive) {
      this.scheduleJob(job);
    } else {
      // Clear timer
      const existingTimer = this.timers.get(jobId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.timers.delete(jobId);
      }
    }

    this.saveScheduledJobs();
    return true;
  }

  // Get job status summary
  getSchedulerStatus(): {
    totalJobs: number;
    activeJobs: number;
    nextRun?: string;
    recentExecutions: number;
  } {
    const activeJobs = this.scheduledJobs.filter(job => job.isActive);
    const nextRuns = activeJobs
      .map(job => job.nextRun)
      .filter(Boolean)
      .map(time => new Date(time!))
      .sort((a, b) => a.getTime() - b.getTime());

    const recentExecutions = this.scheduledJobs.filter(job => {
      if (!job.lastRun) return false;
      const lastRun = new Date(job.lastRun);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastRun > oneDayAgo;
    }).length;

    return {
      totalJobs: this.scheduledJobs.length,
      activeJobs: activeJobs.length,
      nextRun: nextRuns.length > 0 ? nextRuns[0].toISOString() : undefined,
      recentExecutions
    };
  }

  // Force execute a job now (for testing)
  async executeJobNow(jobId: string): Promise<void> {
    const job = this.scheduledJobs.find(job => job.id === jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await this.executeScheduledJob(job);
  }

  // Clear all completed job results
  clearJobResults(): void {
    this.scheduledJobs.forEach(job => {
      delete job.lastResult;
    });
    this.saveScheduledJobs();
  }
}

// Export singleton instance
export const scheduledJobsService = new ScheduledJobsService(); 