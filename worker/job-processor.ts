// Server-side job processor for Cloudflare Workers
// Handles background job execution independently of browser sessions

import { DatabaseService, BackgroundJob } from './database';
import { ShopifyServerAPI, BulkOperationResult } from './shopify-server';

export interface JobProcessorConfig {
  maxConcurrentJobs: number;
  jobTimeoutMinutes: number;
  retryAttempts: number;
  batchSize: number;
}

export class JobProcessor {
  private db: DatabaseService;
  private config: JobProcessorConfig;
  private activeJobs: Map<string, AbortController> = new Map();

  constructor(db: DatabaseService, config?: Partial<JobProcessorConfig>) {
    console.log(`🔧 JobProcessor constructor called`);
    this.db = db;
    this.config = {
      maxConcurrentJobs: 3,
      jobTimeoutMinutes: 60,
      retryAttempts: 3,
      batchSize: 10,
      ...config
    };
    console.log(`✅ JobProcessor constructor completed with config:`, this.config);
  }

  /**
   * Process all pending jobs for all users
   */
  async processAllPendingJobs(): Promise<void> {
    console.log('🔄 Starting job processor...');
    
    try {
      // Get all users (we'll need to modify database to get all users)
      const users = await this.getAllUsers();
      
      for (const user of users) {
        await this.processUserJobs(user.id);
      }
    } catch (error) {
      console.error('Error processing jobs:', error);
    }
  }

  /**
   * Process pending jobs for a specific user
   */
  async processUserJobs(userId: number): Promise<void> {
    console.log(`🚀 processUserJobs ENTRY POINT - userId: ${userId}`);
    console.log(`🔧 TEST: This is a simple test log to verify method is called`);
    console.log(`🔧 TEST: Database service exists:`, !!this.db);
    console.log(`🔧 TEST: Config exists:`, !!this.config);
    
    try {
      // Get user's Shopify config
      console.log(`🔧 Getting Shopify config for user ${userId}`);
      const shopifyConfig = await this.db.getShopifyConfig(userId);
      if (!shopifyConfig || !shopifyConfig.access_token) {
        console.log(`⚠️  User ${userId}: No Shopify configuration found`);
        return;
      }
      console.log(`✅ Shopify config found for user ${userId}: ${shopifyConfig.shop_domain}`);

      // Get pending jobs
      console.log(`🔧 Getting pending jobs for user ${userId}`);
      const pendingJobs = await this.getPendingJobs(userId);
      console.log(`📊 Found ${pendingJobs.length} pending jobs for user ${userId}`);
      
      if (pendingJobs.length === 0) {
        console.log(`ℹ️  No pending jobs found for user ${userId}`);
        return;
      }

      console.log(`📋 User ${userId}: Found ${pendingJobs.length} pending jobs`);
      console.log(`📋 Pending jobs:`, pendingJobs.map(j => ({ id: j.id, status: j.status, type: j.type })));

      // Initialize Shopify API
      console.log(`🔧 Initializing Shopify API for shop: ${shopifyConfig.shop_domain}`);
      const shopifyAPI = new ShopifyServerAPI({
        shopDomain: shopifyConfig.shop_domain,
        accessToken: shopifyConfig.access_token
      });

      // Process jobs (respecting concurrency limits)
      const activeUserJobs = Array.from(this.activeJobs.keys())
        .filter(jobId => pendingJobs.some(job => job.id === jobId));

      console.log(`🔧 Active jobs: ${this.activeJobs.size}, Active user jobs: ${activeUserJobs.length}`);
      console.log(`🔧 Max concurrent jobs: ${this.config.maxConcurrentJobs}`);

      const availableSlots = this.config.maxConcurrentJobs - activeUserJobs.length;
      const jobsToProcess = pendingJobs.slice(0, availableSlots);

      console.log(`🔧 Available slots: ${availableSlots}, Jobs to process: ${jobsToProcess.length}`);
      console.log(`🔧 Jobs to process:`, jobsToProcess.map(j => ({ id: j.id, status: j.status })));

      for (const job of jobsToProcess) {
        console.log(`🔧 Processing job ${job.id}...`);
        
        // Skip if job is already being processed
        if (this.activeJobs.has(job.id)) {
          console.log(`⚠️  Job ${job.id} is already being processed, skipping`);
          continue;
        }

        console.log(`🚀 About to start processing job ${job.id}`);
        // Start processing job (run in background)
        this.processJob(userId, job, shopifyAPI).catch(error => {
          console.error(`💥 Unhandled error in processJob for ${job.id}:`, error);
        });
        console.log(`🚀 processJob called for ${job.id}`);
      }

    } catch (error) {
      console.error(`Error processing jobs for user ${userId}:`, error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(userId: number, job: BackgroundJob, shopifyAPI: ShopifyServerAPI): Promise<void> {
    const abortController = new AbortController();
    this.activeJobs.set(job.id, abortController);

    console.log(`🚀 Starting job ${job.id}: ${job.type} for segment "${job.segment_name}"`);

    try {
      // Update job status to running
      console.log(`📝 Updating job ${job.id} status to running`);
      await this.updateJobStatus(userId, job.id, 'running', 'Job started on server');
      console.log(`✅ Job ${job.id} status updated to running`);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Job ${job.id} timed out after ${this.config.jobTimeoutMinutes} minutes`);
        abortController.abort();
      }, this.config.jobTimeoutMinutes * 60 * 1000);

      // Create progress callback
      const onProgress = async (current: number, total: number, skipped: number, message: string) => {
        if (abortController.signal.aborted) {
          throw new Error('Job was cancelled');
        }

        console.log(`📊 Job ${job.id} progress: ${current}/${total} (${message})`);
        await this.updateJobProgress(userId, job.id, current, total, skipped, message);
      };

      // Execute the bulk operation
      let result: BulkOperationResult;
      
      console.log(`🔄 Starting bulk operation for job ${job.id}`);
      
      if (job.type === 'bulk_add_tags') {
        console.log(`➕ Calling bulkAddTagsToSegment for segment ${job.segment_id} with tags: ${job.tags.join(', ')}`);
        
        // Test Shopify API connectivity first
        console.log(`🧪 Testing Shopify API connectivity before bulk operation...`);
        console.log(`🧪 ShopifyAPI initialized: ${shopifyAPI.isInitialized()}`);
        
        try {
          console.log(`🧪 About to call bulkAddTagsToSegment...`);
          result = await shopifyAPI.bulkAddTagsToSegment(
            job.segment_id,
            job.segment_name,
            job.tags,
            onProgress,
            this.config.batchSize
          );
          console.log(`🧪 bulkAddTagsToSegment completed successfully`);
        } catch (error) {
          console.error(`💥 CRITICAL ERROR in bulkAddTagsToSegment:`, error);
          console.error(`💥 Error details:`, {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack trace'
          });
          throw error;
        }
      } else if (job.type === 'bulk_remove_tags') {
        console.log(`➖ Calling bulkRemoveTagsFromSegment for segment ${job.segment_id} with tags: ${job.tags.join(', ')}`);
        result = await shopifyAPI.bulkRemoveTagsFromSegment(
          job.segment_id,
          job.segment_name,
          job.tags,
          onProgress,
          this.config.batchSize
        );
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      console.log(`🏁 Bulk operation completed for job ${job.id}:`, result);

      // Clear timeout
      clearTimeout(timeoutId);

      // Complete the job
      console.log(`📝 Completing job ${job.id}`);
      await this.completeJob(userId, job.id, result);

      console.log(`✅ Job ${job.id} completed successfully: ${result.processedCount} processed, ${result.skippedCount} skipped`);

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      
      // Handle job failure
      await this.failJob(userId, job.id, error instanceof Error ? error.message : 'Unknown error');
      
    } finally {
      // Clean up
      console.log(`🧹 Cleaning up job ${job.id}`);
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Get pending jobs for a user
   */
  private async getPendingJobs(userId: number): Promise<BackgroundJob[]> {
    console.log(`🔍 getPendingJobs: Getting all jobs for user ${userId}`);
    const allJobs = await this.db.getAllBackgroundJobs(userId);
    console.log(`🔍 getPendingJobs: Found ${allJobs.length} total jobs`);
    
    // Log all jobs for debugging
    allJobs.forEach((job, index) => {
      console.log(`🔍 Job ${index + 1}: ID=${job.id}, status=${job.status}, type=${job.type}, start_time=${job.start_time}, last_update=${job.last_update}`);
    });
    
    const pendingJobs = allJobs.filter(job => {
      // Include jobs that are queued or need resumption
      if (job.status === 'running') {
        // Check if job has been stale for too long (needs resumption)
        const lastUpdate = new Date(job.last_update);
        const now = new Date();
        const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        console.log(`🔍 Running job ${job.id}: ${minutesSinceUpdate.toFixed(1)} minutes since last update`);
        return minutesSinceUpdate > 5; // Resume if no update for 5+ minutes
      }
      
      const isPending = job.status === 'queued' || job.status === 'paused';
      console.log(`🔍 Job ${job.id}: status=${job.status}, isPending=${isPending}`);
      return isPending;
    });
    
    console.log(`🔍 getPendingJobs: Filtered to ${pendingJobs.length} pending jobs`);
    return pendingJobs;
  }

  /**
   * Update job status
   */
  private async updateJobStatus(userId: number, jobId: string, status: BackgroundJob['status'], message: string): Promise<void> {
    console.log(`🔧 updateJobStatus called for job ${jobId}, status: ${status}, message: ${message}`);
    
    try {
      console.log(`🔄 About to call db.updateBackgroundJob for job ${jobId}`);
      
      const updateData = {
        status,
        progress: {
          current: 0,
          total: 0,
          skipped: 0,
          message
        },
        last_update: new Date().toISOString()
      };
      
      console.log(`📋 Update data for job ${jobId}:`, JSON.stringify(updateData, null, 2));
      
      // Add a simple test first
      console.log(`🧪 Testing: About to call updateBackgroundJob...`);
      const result = await this.db.updateBackgroundJob(userId, jobId, updateData);
      console.log(`🧪 Testing: updateBackgroundJob returned:`, result);
      
      console.log(`✅ Successfully updated job ${jobId} status to ${status}`);
    } catch (error) {
      console.error(`💥 CRITICAL ERROR updating job ${jobId} status:`, error);
      console.error(`💥 Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(userId: number, jobId: string, current: number, total: number, skipped: number, message: string): Promise<void> {
    try {
      await this.db.updateBackgroundJob(userId, jobId, {
        progress: {
          current,
          total,
          skipped,
          message
        },
        last_update: new Date().toISOString()
      });
      console.log(`✅ Updated job ${jobId} progress: ${current}/${total}`);
    } catch (error) {
      console.error(`❌ Failed to update job ${jobId} progress:`, error);
      // Don't throw here - progress updates shouldn't kill the job
    }
  }

  /**
   * Complete a job successfully
   */
  private async completeJob(userId: number, jobId: string, result: BulkOperationResult): Promise<void> {
    await this.db.updateBackgroundJob(userId, jobId, {
      status: result.success ? 'completed' : 'failed',
      result: {
        success: result.success,
        processedCount: result.processedCount,
        skippedCount: result.skippedCount,
        errors: result.errors
      },
      end_time: new Date().toISOString(),
      last_update: new Date().toISOString()
    });
  }

  /**
   * Mark a job as failed
   */
  private async failJob(userId: number, jobId: string, errorMessage: string): Promise<void> {
    await this.db.updateBackgroundJob(userId, jobId, {
      status: 'failed',
      result: {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: [errorMessage]
      },
      end_time: new Date().toISOString(),
      last_update: new Date().toISOString()
    });
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const abortController = this.activeJobs.get(jobId);
    if (abortController) {
      abortController.abort();
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Get all users
   */
  private async getAllUsers(): Promise<Array<{ id: number; username: string }>> {
    return await this.db.getAllUsers();
  }

  /**
   * Get job processor statistics
   */
  getStats(): {
    activeJobs: number;
    maxConcurrentJobs: number;
    availableSlots: number;
  } {
    return {
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      availableSlots: this.config.maxConcurrentJobs - this.activeJobs.size
    };
  }
}

/**
 * Queue a job for server-side processing
 */
export async function queueServerJob(
  db: DatabaseService,
  userId: number,
  type: 'bulk_add_tags' | 'bulk_remove_tags',
  segmentId: number,
  segmentName: string,
  tags: string[]
): Promise<string> {
  try {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Creating job ${jobId} for user ${userId}`);
    
    const job = {
      id: jobId,
      type,
      status: 'queued' as const,
      segment_id: segmentId,
      segment_name: segmentName,
      tags,
      progress: {
        current: 0,
        total: 0,
        skipped: 0,
        message: 'Queued for server processing'
      },
      start_time: new Date().toISOString(),
      last_update: new Date().toISOString(),
      is_cancelled: false
    };

    console.log('Job object created:', job);
    
    await db.createBackgroundJob(userId, job);
    
    console.log(`📝 Queued server job ${jobId}: ${type} for segment "${segmentName}"`);
    
    return jobId;
  } catch (error) {
    console.error('Error in queueServerJob:', error);
    throw error;
  }
} 