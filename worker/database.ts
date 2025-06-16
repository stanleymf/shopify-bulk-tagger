// Server-side database service for Bulk-Tagger
// Replaces localStorage with persistent D1 database storage

import type { D1Database } from './types';

export interface User {
  id: number;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyConfig {
  id: number;
  user_id: number;
  shop_domain: string;
  api_key?: string;
  api_secret?: string;
  access_token: string;
  is_connected: boolean;
  last_sync?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerSegment {
  id: number;
  user_id: number;
  name: string;
  query?: string;
  customer_count: number;
  is_loading_count: boolean;
  created_at: string;
  updated_at: string;
  last_synced: string;
}

export interface BackgroundJob {
  id: string;
  user_id: number;
  type: 'bulk_add_tags' | 'bulk_remove_tags';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  segment_id: number;
  segment_name: string;
  tags: string[]; // Will be JSON stringified in DB
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
  start_time: string;
  end_time?: string;
  last_update: string;
  is_cancelled: boolean;
}



export interface SegmentMonitoring {
  id: number;
  user_id: number;
  customer_id: number;
  segment_id: number;
  segment_name: string;
  action: 'enter' | 'exit' | 'move';
  previous_segment_id?: number;
  previous_segment_name?: string;
  detected_at: string;
  processed: boolean;
}

export interface AppSetting {
  id: number;
  user_id: number;
  setting_key: string;
  setting_value: any; // Will be JSON stringified in DB
  created_at: string;
  updated_at: string;
}

interface Env {
  DB: D1Database;
  USERNAME: string;
  PASSWORD: string;
}

export class DatabaseService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Initialize database schema
  async initializeSchema(): Promise<void> {
    // This would run the schema.sql file on first deployment
    console.log('Database schema initialized');
  }

  // User management
  async createUser(username: string, passwordHash: string): Promise<User> {
    const result = await this.db.prepare(`
      INSERT INTO users (username, password_hash) 
      VALUES (?, ?) 
      RETURNING id, username, created_at, updated_at
    `).bind(username, passwordHash).first<User>();
    
    if (!result) throw new Error('Failed to create user');
    return result;
  }

  async getUserByUsername(username: string): Promise<User & { password_hash: string } | null> {
    return await this.db.prepare(`
      SELECT id, username, password_hash, created_at, updated_at 
      FROM users 
      WHERE username = ?
    `).bind(username).first<User & { password_hash: string }>();
  }

  async getUserById(userId: number): Promise<User | null> {
    return await this.db.prepare(`
      SELECT id, username, created_at, updated_at 
      FROM users 
      WHERE id = ?
    `).bind(userId).first<User>();
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.db.prepare(`
      SELECT id, username, created_at, updated_at 
      FROM users 
      ORDER BY created_at ASC
    `).all<User>();
    
    return result.results || [];
  }

  // Shopify configuration management
  async saveShopifyConfig(userId: number, config: Partial<ShopifyConfig>): Promise<ShopifyConfig> {
    const existing = await this.getShopifyConfig(userId);
    
    if (existing) {
      // Update existing config
      const result = await this.db.prepare(`
        UPDATE shopify_configs 
        SET shop_domain = ?, api_key = ?, api_secret = ?, access_token = ?, 
            is_connected = ?, last_sync = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        RETURNING *
      `).bind(
        config.shop_domain || existing.shop_domain,
        config.api_key || existing.api_key,
        config.api_secret || existing.api_secret,
        config.access_token || existing.access_token,
        config.is_connected ?? existing.is_connected,
        config.last_sync || existing.last_sync,
        userId
      ).first<ShopifyConfig>();
      
      if (!result) throw new Error('Failed to update Shopify config');
      return result;
    } else {
      // Create new config
      const result = await this.db.prepare(`
        INSERT INTO shopify_configs (user_id, shop_domain, api_key, api_secret, access_token, is_connected, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        userId,
        config.shop_domain || '',
        config.api_key || null,
        config.api_secret || null,
        config.access_token || '',
        config.is_connected || false,
        config.last_sync || null
      ).first<ShopifyConfig>();
      
      if (!result) throw new Error('Failed to create Shopify config');
      return result;
    }
  }

  async getShopifyConfig(userId: number): Promise<ShopifyConfig | null> {
    return await this.db.prepare(`
      SELECT * FROM shopify_configs WHERE user_id = ?
    `).bind(userId).first<ShopifyConfig>();
  }

  async clearShopifyConfig(userId: number): Promise<void> {
    await this.db.prepare(`
      DELETE FROM shopify_configs WHERE user_id = ?
    `).bind(userId).run();
  }

  // Customer segments management
  async saveSegments(userId: number, segments: any[]): Promise<void> {
    // Clear existing segments for this user
    await this.db.prepare(`
      DELETE FROM customer_segments WHERE user_id = ?
    `).bind(userId).run();

    // Insert new segments
    for (const segment of segments) {
      await this.db.prepare(`
        INSERT INTO customer_segments 
        (id, user_id, name, query, customer_count, is_loading_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        segment.id,
        userId,
        segment.name,
        segment.query || null,
        segment.customer_count || 0,
        segment.is_loading_count || false,
        segment.created_at,
        segment.updated_at
      ).run();
    }
  }

  async getSegments(userId: number): Promise<CustomerSegment[]> {
    const result = await this.db.prepare(`
      SELECT * FROM customer_segments 
      WHERE user_id = ? 
      ORDER BY name ASC
    `).bind(userId).all<CustomerSegment>();
    
    return result.results || [];
  }

  async updateSegmentCustomerCount(userId: number, segmentId: number, count: number): Promise<void> {
    await this.db.prepare(`
      UPDATE customer_segments 
      SET customer_count = ?, is_loading_count = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND id = ?
    `).bind(count, userId, segmentId).run();
  }

  async setSegmentCountLoading(userId: number, segmentId: number, isLoading: boolean): Promise<void> {
    await this.db.prepare(`
      UPDATE customer_segments 
      SET is_loading_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND id = ?
    `).bind(isLoading, userId, segmentId).run();
  }

  // Background jobs management
  async createBackgroundJob(userId: number, job: Omit<BackgroundJob, 'user_id'>): Promise<BackgroundJob> {
    const result = await this.db.prepare(`
      INSERT INTO background_jobs 
      (id, user_id, type, status, segment_id, segment_name, tags, 
       progress_current, progress_total, progress_skipped, progress_message,
       start_time, last_update, is_cancelled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      job.id,
      userId,
      job.type,
      job.status,
      job.segment_id,
      job.segment_name,
      JSON.stringify(job.tags),
      job.progress.current,
      job.progress.total,
      job.progress.skipped,
      job.progress.message,
      job.start_time,
      job.last_update,
      job.is_cancelled
    ).first();

    if (!result) throw new Error('Failed to create background job');
    return this.mapJobFromDB(result);
  }

  async updateBackgroundJob(userId: number, jobId: string, updates: Partial<BackgroundJob>): Promise<BackgroundJob> {
    console.log(`🔧 updateBackgroundJob called for job ${jobId} with updates:`, JSON.stringify(updates, null, 2));
    
    const job = await this.getBackgroundJob(userId, jobId);
    if (!job) {
      console.log(`❌ Job ${jobId} not found for user ${userId}`);
      throw new Error('Job not found');
    }
    
    console.log(`📋 Current job state:`, JSON.stringify(job, null, 2));

    // Use a simpler approach - merge updates with existing job data
    const updatedJob = { ...job, ...updates };
    
    // Handle nested progress object properly
    if (updates.progress) {
      updatedJob.progress = { ...job.progress, ...updates.progress };
    }
    
    // Handle nested result object properly
    if (updates.result) {
      updatedJob.result = updates.result;
    }

    console.log(`🔄 About to update job with data:`, JSON.stringify(updatedJob, null, 2));

    try {
      const result = await this.db.prepare(`
        UPDATE background_jobs 
        SET status = ?, progress_current = ?, progress_total = ?, progress_skipped = ?,
            progress_message = ?, result_success = ?, result_processed_count = ?, 
            result_skipped_count = ?, result_errors = ?, end_time = ?, 
            last_update = CURRENT_TIMESTAMP, is_cancelled = ?
        WHERE user_id = ? AND id = ?
        RETURNING *
      `).bind(
        updatedJob.status,
        updatedJob.progress.current,
        updatedJob.progress.total,
        updatedJob.progress.skipped,
        updatedJob.progress.message,
        updatedJob.result?.success ?? null,
        updatedJob.result?.processedCount ?? null,
        updatedJob.result?.skippedCount ?? null,
        updatedJob.result?.errors ? JSON.stringify(updatedJob.result.errors) : null,
        updatedJob.end_time ?? null,
        updatedJob.is_cancelled,
        userId,
        jobId
      ).first();

      console.log(`💾 Database update result:`, result ? 'SUCCESS' : 'NO RESULT');
      
      if (!result) {
        console.log(`❌ Database update returned no result for job ${jobId}`);
        throw new Error('Failed to update background job');
      }
      
      const mappedResult = this.mapJobFromDB(result);
      console.log(`✅ Successfully updated job ${jobId} to status: ${mappedResult.status}`);
      return mappedResult;
      
    } catch (error) {
      console.log(`💥 Database update error for job ${jobId}:`, error);
      throw error;
    }
  }

  async getBackgroundJob(userId: number, jobId: string): Promise<BackgroundJob | null> {
    console.log(`🔍 getBackgroundJob called for user ${userId}, job ${jobId}`);
    
    try {
      const result = await this.db.prepare(`
        SELECT * FROM background_jobs WHERE user_id = ? AND id = ?
      `).bind(userId, jobId).first();

      console.log(`🔍 getBackgroundJob result:`, result ? 'FOUND' : 'NOT FOUND');
      if (result) {
        console.log(`🔍 Raw job data:`, result);
      }

      return result ? this.mapJobFromDB(result) : null;
    } catch (error) {
      console.error(`💥 CRITICAL ERROR in getBackgroundJob:`, error);
      console.error(`💥 Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  }

  async getAllBackgroundJobs(userId: number): Promise<BackgroundJob[]> {
    console.log(`🔍 getAllBackgroundJobs called for user ${userId}`);
    
    try {
      const result = await this.db.prepare(`
        SELECT * FROM background_jobs 
        WHERE user_id = ? 
        ORDER BY start_time DESC 
        LIMIT 10
      `).bind(userId).all();
      
      console.log(`🔍 Database query result:`, {
        success: result.success,
        resultsLength: result.results?.length || 0,
        error: result.error
      });
      
      if (!result.results) {
        console.log(`🔍 No results returned from database`);
        return [];
      }
      
      console.log(`🔍 Raw database results (first 2):`, result.results.slice(0, 2));
      
      const mappedJobs = result.results.map(job => this.mapJobFromDB(job));
      console.log(`🔍 Mapped ${mappedJobs.length} jobs successfully`);
      console.log(`🔍 First mapped job:`, mappedJobs[0]);
      
      return mappedJobs;
    } catch (error) {
      console.error(`💥 CRITICAL ERROR in getAllBackgroundJobs:`, error);
      console.error(`💥 Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  }

  async getActiveBackgroundJob(userId: number): Promise<BackgroundJob | null> {
    const result = await this.db.prepare(`
      SELECT * FROM background_jobs 
      WHERE user_id = ? AND status = 'running'
      ORDER BY start_time DESC 
      LIMIT 1
    `).bind(userId).first();

    return result ? this.mapJobFromDB(result) : null;
  }

  async clearCompletedJobs(userId: number): Promise<void> {
    await this.db.prepare(`
      DELETE FROM background_jobs 
      WHERE user_id = ? AND status IN ('completed', 'failed', 'cancelled')
    `).bind(userId).run();
  }

  // Helper method to map database result to BackgroundJob interface
  private mapJobFromDB(dbJob: any): BackgroundJob {
    return {
      id: dbJob.id,
      user_id: dbJob.user_id,
      type: dbJob.type,
      status: dbJob.status,
      segment_id: dbJob.segment_id,
      segment_name: dbJob.segment_name,
      tags: JSON.parse(dbJob.tags || '[]'),
      progress: {
        current: dbJob.progress_current || 0,
        total: dbJob.progress_total || 0,
        skipped: dbJob.progress_skipped || 0,
        message: dbJob.progress_message || 'Initializing...'
      },
      result: dbJob.result_success !== null ? {
        success: dbJob.result_success,
        processedCount: dbJob.result_processed_count || 0,
        skippedCount: dbJob.result_skipped_count || 0,
        errors: JSON.parse(dbJob.result_errors || '[]')
      } : undefined,
      start_time: dbJob.start_time,
      end_time: dbJob.end_time,
      last_update: dbJob.last_update,
      is_cancelled: dbJob.is_cancelled || false
    };
  }



  // App settings management
  async saveSetting(userId: number, key: string, value: any): Promise<AppSetting> {
    const result = await this.db.prepare(`
      INSERT OR REPLACE INTO app_settings (user_id, setting_key, setting_value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      RETURNING *
    `).bind(userId, key, JSON.stringify(value)).first<AppSetting>();

    if (!result) throw new Error('Failed to save setting');
    return {
      ...result,
      setting_value: JSON.parse(result.setting_value as string)
    };
  }

  async getSetting(userId: number, key: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT setting_value FROM app_settings WHERE user_id = ? AND setting_key = ?
    `).bind(userId, key).first<{ setting_value: string }>();

    return result ? JSON.parse(result.setting_value) : null;
  }

  async getAllSettings(userId: number): Promise<Record<string, any>> {
    const result = await this.db.prepare(`
      SELECT setting_key, setting_value FROM app_settings WHERE user_id = ?
    `).bind(userId).all<{ setting_key: string; setting_value: string }>();

    const settings: Record<string, any> = {};
    (result.results || []).forEach(row => {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    });

    return settings;
  }

  async deleteSetting(userId: number, key: string): Promise<void> {
    await this.db.prepare(`
      DELETE FROM app_settings WHERE user_id = ? AND setting_key = ?
    `).bind(userId, key).run();
  }

  // Segment monitoring management
  async saveSegmentMonitoring(userId: number, monitoring: Omit<SegmentMonitoring, 'id' | 'user_id' | 'detected_at'>): Promise<SegmentMonitoring> {
    const result = await this.db.prepare(`
      INSERT INTO segment_monitoring 
      (user_id, customer_id, segment_id, segment_name, action, 
       previous_segment_id, previous_segment_name, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      userId,
      monitoring.customer_id,
      monitoring.segment_id,
      monitoring.segment_name,
      monitoring.action,
      monitoring.previous_segment_id || null,
      monitoring.previous_segment_name || null,
      monitoring.processed
    ).first<SegmentMonitoring>();

    if (!result) throw new Error('Failed to save segment monitoring data');
    return result;
  }

  async getUnprocessedMonitoring(userId: number): Promise<SegmentMonitoring[]> {
    const result = await this.db.prepare(`
      SELECT * FROM segment_monitoring 
      WHERE user_id = ? AND processed = FALSE
      ORDER BY detected_at ASC
    `).bind(userId).all<SegmentMonitoring>();

    return result.results || [];
  }

  async markMonitoringProcessed(userId: number, monitoringId: number): Promise<void> {
    await this.db.prepare(`
      UPDATE segment_monitoring 
      SET processed = TRUE 
      WHERE user_id = ? AND id = ?
    `).bind(userId, monitoringId).run();
  }

  async clearMonitoringHistory(userId: number): Promise<void> {
    await this.db.prepare(`
      DELETE FROM segment_monitoring WHERE user_id = ?
    `).bind(userId).run();
  }
} 