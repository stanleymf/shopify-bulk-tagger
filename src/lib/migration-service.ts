// Migration service for transitioning from localStorage to server-side storage
// Provides backward compatibility and data migration capabilities

import { storage as localStorageService } from './storage';
import { serverStorage } from './server-storage';
import type { ShopifyConfig } from './storage';

export interface MigrationStatus {
  isLocalDataAvailable: boolean;
  isServerDataAvailable: boolean;
  needsMigration: boolean;
  localDataCount: {
    segments: number;
    jobs: number;
    hasConfig: boolean;
  };
  serverDataCount: {
    segments: number;
    jobs: number;
    hasConfig: boolean;
  };
}

export interface MigrationResult {
  success: boolean;
  migratedItems: {
    shopifyConfig: boolean;
    segments: number;
    backgroundJobs: number;
    settings: number;
  };
  errors: string[];
}

class MigrationService {
  private migrationInProgress: boolean = false;
  private useServerStorage: boolean = false;

  constructor() {
    // Check if we should use server storage by default
    this.checkStoragePreference();
  }

  // Check user's storage preference
  private checkStoragePreference(): void {
    try {
      const preference = localStorage.getItem('bulk_tagger_storage_preference');
      this.useServerStorage = preference === 'server';
    } catch (error) {
      console.warn('Could not check storage preference:', error);
      this.useServerStorage = false;
    }
  }

  // Set storage preference
  setStoragePreference(useServer: boolean): void {
    try {
      this.useServerStorage = useServer;
      localStorage.setItem('bulk_tagger_storage_preference', useServer ? 'server' : 'local');
    } catch (error) {
      console.warn('Could not save storage preference:', error);
    }
  }

  // Check if migration is needed
  async getMigrationStatus(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      isLocalDataAvailable: false,
      isServerDataAvailable: false,
      needsMigration: false,
      localDataCount: {
        segments: 0,
        jobs: 0,
        hasConfig: false
      },
      serverDataCount: {
        segments: 0,
        jobs: 0,
        hasConfig: false
      }
    };

    // Check local storage data
    try {
      const localConfig = localStorageService.getShopifyConfig();
      const localSegments = localStorageService.getSegments();

      
      status.localDataCount.hasConfig = !!localConfig;
      status.localDataCount.segments = localSegments.length;
      
      // Check background jobs in localStorage
      try {
        const jobsData = localStorage.getItem('bulk_tagger_background_jobs');
        if (jobsData) {
          const jobs = JSON.parse(jobsData);
          status.localDataCount.jobs = Array.isArray(jobs) ? jobs.length : 0;
        }
      } catch (error) {
        console.warn('Could not check local background jobs:', error);
      }

      status.isLocalDataAvailable = status.localDataCount.hasConfig || 
                                   status.localDataCount.segments > 0 || 
                                   status.localDataCount.jobs > 0;
    } catch (error) {
      console.warn('Could not check local storage data:', error);
    }

    // Check server storage data only if we're not currently using it as primary
    try {
      if (this.useServerStorage) {
        // If already using server storage, assume it's available
        status.isServerDataAvailable = true;
        status.serverDataCount.hasConfig = true; // Assume has config if using server storage
      } else {
        // Test server availability
        const isServerAvailable = await serverStorage.isStorageAvailable();
        if (isServerAvailable) {
          const serverConfig = await serverStorage.getShopifyConfig();
          const serverSegments = await serverStorage.getSegments();
          const serverJobs = await serverStorage.getBackgroundJobs();


          status.serverDataCount.hasConfig = !!serverConfig;
          status.serverDataCount.segments = serverSegments.length;
          status.serverDataCount.jobs = serverJobs.length;

          status.isServerDataAvailable = status.serverDataCount.hasConfig || 
                                        status.serverDataCount.segments > 0 || 
                                        status.serverDataCount.jobs > 0;
        }
      }
    } catch (error) {
      console.warn('Could not check server storage data:', error);
      status.isServerDataAvailable = false;
    }

    // Determine if migration is needed
    status.needsMigration = status.isLocalDataAvailable && !status.isServerDataAvailable && !this.useServerStorage;

    return status;
  }

  // Migrate data from localStorage to server storage
  async migrateToServer(): Promise<MigrationResult> {
    if (this.migrationInProgress) {
      throw new Error('Migration already in progress');
    }

    this.migrationInProgress = true;
    const result: MigrationResult = {
      success: false,
      migratedItems: {
        shopifyConfig: false,
        segments: 0,
        backgroundJobs: 0,
        settings: 0
      },
      errors: []
    };

    try {
      console.log('🔄 Starting migration from localStorage to server...');

      // Migrate Shopify configuration
      try {
        const localConfig = localStorageService.getShopifyConfig();
        if (localConfig) {
          await serverStorage.saveShopifyConfig(localConfig);
          result.migratedItems.shopifyConfig = true;
          console.log('✅ Migrated Shopify configuration');
        }
      } catch (error) {
        const errorMsg = `Failed to migrate Shopify config: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      // Migrate customer segments
      try {
        const localSegments = localStorageService.getSegments();
        if (localSegments.length > 0) {
          await serverStorage.saveSegments(localSegments);
          result.migratedItems.segments = localSegments.length;
          console.log(`✅ Migrated ${localSegments.length} customer segments`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate segments: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      // Migrate background jobs
      try {
        const jobsData = localStorage.getItem('bulk_tagger_background_jobs');
        if (jobsData) {
          const localJobs = JSON.parse(jobsData);
          if (Array.isArray(localJobs) && localJobs.length > 0) {
            for (const job of localJobs) {
              await serverStorage.createBackgroundJob(job);
            }
            result.migratedItems.backgroundJobs = localJobs.length;
            console.log(`✅ Migrated ${localJobs.length} background jobs`);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to migrate background jobs: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error('❌', errorMsg);
      }



      // Migrate app settings (last sync, etc.)
      try {
        const lastSync = localStorageService.getLastSync();
        if (lastSync) {
          await serverStorage.saveSetting('lastSync', lastSync);
          result.migratedItems.settings++;
          console.log('✅ Migrated last sync timestamp');
        }
      } catch (error) {
        const errorMsg = `Failed to migrate settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      // Migration successful if we have at least some data migrated and no critical errors
      const hasMigratedData = result.migratedItems.shopifyConfig || 
                             result.migratedItems.segments > 0 || 
                             result.migratedItems.backgroundJobs > 0;

      result.success = hasMigratedData && result.errors.length === 0;

      if (result.success) {
        console.log('🎉 Migration completed successfully!');
        // Set preference to use server storage
        this.setStoragePreference(true);
      } else if (hasMigratedData) {
        console.log('⚠️ Migration completed with some errors');
      } else {
        console.log('❌ Migration failed - no data was migrated');
      }

    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('❌', errorMsg);
    } finally {
      this.migrationInProgress = false;
    }

    return result;
  }

  // Clear localStorage after successful migration
  async clearLocalStorageAfterMigration(): Promise<void> {
    try {
      console.log('🧹 Clearing localStorage after successful migration...');
      
      // Clear specific Bulk-Tagger localStorage keys
      const keysToRemove = [
        'bulk_tagger_data',
        'bulk_tagger_shopify_config',
        'bulk_tagger_background_jobs',
        'bulk_tagger_auth',
        'bulk_tagger_fallback'
      ];

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Could not remove ${key}:`, error);
        }
      });

      console.log('✅ localStorage cleanup completed');
    } catch (error) {
      console.error('Error during localStorage cleanup:', error);
    }
  }

  // Hybrid storage methods - use server storage if available, fallback to localStorage
  getShopifyConfig(): ShopifyConfig | null {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      console.warn('Server storage getShopifyConfig called synchronously, returning cached value');
      return null; // Cannot get server data synchronously
    }
    return localStorageService.getShopifyConfig();
  }

  async getShopifyConfigAsync(): Promise<ShopifyConfig | null> {
    if (this.useServerStorage) {
      try {
        return await serverStorage.getShopifyConfig();
      } catch (error) {
        console.warn('Server storage failed, falling back to localStorage:', error);
        return localStorageService.getShopifyConfig();
      }
    }
    return localStorageService.getShopifyConfig();
  }

  saveShopifyConfig(config: Partial<ShopifyConfig>): void {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      // Fire and forget for sync compatibility
      this.saveShopifyConfigAsync(config).catch(error => {
        console.warn('Async saveShopifyConfig failed:', error);
      });
    } else {
      localStorageService.saveShopifyConfig(config);
    }
  }

  async saveShopifyConfigAsync(config: Partial<ShopifyConfig>): Promise<void> {
    if (this.useServerStorage) {
      try {
        await serverStorage.saveShopifyConfig(config);
        return;
      } catch (error) {
        console.warn('Server storage failed, falling back to localStorage:', error);
      }
    }
    localStorageService.saveShopifyConfig(config);
  }

  getSegments(): any[] {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      console.warn('Server storage getSegments called synchronously, returning empty array');
      return []; // Cannot get server data synchronously
    }
    return localStorageService.getSegments();
  }

  async getSegmentsAsync(): Promise<any[]> {
    if (this.useServerStorage) {
      try {
        return await serverStorage.getSegments();
      } catch (error) {
        console.warn('Server storage failed, falling back to localStorage:', error);
        return localStorageService.getSegments();
      }
    }
    return localStorageService.getSegments();
  }

  saveSegments(segments: any[]): void {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      // Fire and forget for sync compatibility
      this.saveSegmentsAsync(segments).catch(error => {
        console.warn('Async saveSegments failed:', error);
      });
    } else {
      localStorageService.saveSegments(segments);
    }
  }

  async saveSegmentsAsync(segments: any[]): Promise<void> {
    if (this.useServerStorage) {
      try {
        await serverStorage.saveSegments(segments);
        return;
      } catch (error) {
        console.warn('Server storage failed, falling back to localStorage:', error);
      }
    }
    localStorageService.saveSegments(segments);
  }

  // Background jobs methods
  async getBackgroundJobs(): Promise<any[]> {
    if (this.useServerStorage) {
      try {
        return await serverStorage.getBackgroundJobs();
      } catch (error) {
        console.warn('Server storage failed for background jobs:', error);
        // Fallback to localStorage background jobs
        try {
          const jobsData = localStorage.getItem('bulk_tagger_background_jobs');
          return jobsData ? JSON.parse(jobsData) : [];
        } catch {
          return [];
        }
      }
    }
    
    // Local storage method
    try {
      const jobsData = localStorage.getItem('bulk_tagger_background_jobs');
      return jobsData ? JSON.parse(jobsData) : [];
    } catch {
      return [];
    }
  }

  async createBackgroundJob(job: any): Promise<void> {
    if (this.useServerStorage) {
      try {
        await serverStorage.createBackgroundJob(job);
        return;
      } catch (error) {
        console.warn('Server storage failed for background job creation:', error);
      }
    }
    
    // Fallback to localStorage
    try {
      const existingJobs = await this.getBackgroundJobs();
      existingJobs.push(job);
      localStorage.setItem('bulk_tagger_background_jobs', JSON.stringify(existingJobs));
    } catch (error) {
      console.error('Failed to save background job to localStorage:', error);
    }
  }

  // Check if we should use server storage
  shouldUseServerStorage(): boolean {
    return this.useServerStorage;
  }

  // Test server connectivity
  async testServerConnection(): Promise<boolean> {
    try {
      return await serverStorage.isStorageAvailable();
    } catch (error) {
      console.warn('Server connection test failed:', error);
      return false;
    }
  }

  // Additional storage methods to match original storage interface
  
  getLastSync(): string | null {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      console.warn('Server storage getLastSync called synchronously, returning cached value');
      return null; // Cannot get server data synchronously
    }
    return localStorageService.getLastSync();
  }

  async getLastSyncAsync(): Promise<string | null> {
    if (this.useServerStorage) {
      try {
        return await serverStorage.getSetting('lastSync');
      } catch (error) {
        console.warn('Server storage failed for lastSync:', error);
        return localStorageService.getLastSync();
      }
    }
    return localStorageService.getLastSync();
  }

  updateLastSync(): void {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      // Fire and forget for sync compatibility
      this.updateLastSyncAsync().catch(error => {
        console.warn('Async updateLastSync failed:', error);
      });
    } else {
      localStorageService.updateLastSync();
    }
  }

  async updateLastSyncAsync(): Promise<void> {
    const timestamp = new Date().toISOString();
    if (this.useServerStorage) {
      try {
        await serverStorage.saveSetting('lastSync', timestamp);
        return;
      } catch (error) {
        console.warn('Server storage failed for updateLastSync:', error);
      }
    }
    localStorageService.updateLastSync();
  }

  saveAppData(data: any): void {
    // Synchronous version for backward compatibility
    if (this.useServerStorage) {
      // Fire and forget for sync compatibility
      this.saveAppDataAsync(data).catch(error => {
        console.warn('Async saveAppData failed:', error);
      });
    } else {
      localStorageService.saveAppData(data);
    }
  }

  async saveAppDataAsync(data: any): Promise<void> {
    if (this.useServerStorage) {
      try {
        // Save each property as a separate setting
        for (const [key, value] of Object.entries(data)) {
          await serverStorage.saveSetting(key, value);
        }
        return;
      } catch (error) {
        console.warn('Server storage failed for saveAppData:', error);
      }
    }
    localStorageService.saveAppData(data);
  }



  // Test authentication with server
  async testAuthentication(username: string, password: string): Promise<boolean> {
    try {
      // Update server storage credentials temporarily for testing
      const testStorage = serverStorage;
      (testStorage as any).config.username = username;
      (testStorage as any).config.password = password;
      
      // Test connection
      const isAvailable = await testStorage.isStorageAvailable();
      return isAvailable;
    } catch (error) {
      console.error('Authentication test failed:', error);
      return false;
    }
  }

  // Update server storage credentials
  updateServerCredentials(username: string, password: string): void {
    (serverStorage as any).config.username = username;
    (serverStorage as any).config.password = password;
  }
}

// Export singleton instance
export const migrationService = new MigrationService(); 