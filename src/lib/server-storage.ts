// Server-side storage service for Bulk-Tagger
// Replaces localStorage with server-side API calls

import { ShopifyConfig } from './storage';

export interface ServerStorageConfig {
  baseURL: string;
  username?: string;
  password?: string;
}

export interface AppData {
  shopifyConfig: ShopifyConfig | null;
  segments: any[];

  lastSync: string | null;
}

class ServerStorageManager {
  private config: ServerStorageConfig;

  constructor(config: ServerStorageConfig) {
    this.config = config;
  }

  // Get authentication headers for Basic Auth
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Use Basic Auth if credentials are provided
    if (this.config.username && this.config.password) {
      const credentials = btoa(`${this.config.username}:${this.config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  // Make authenticated API request
  private async apiRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: this.getAuthHeaders(),
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        }
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // If this is a network error or CORS issue, treat as server unavailable
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Server storage unavailable');
      }
      throw error;
    }
  }

  // Shopify configuration management
  async getShopifyConfig(): Promise<ShopifyConfig | null> {
    try {
      const config = await this.apiRequest('/api/shopify/config');
      return config;
    } catch (error) {
      console.error('Error fetching Shopify config:', error);
      return null;
    }
  }

  async saveShopifyConfig(config: Partial<ShopifyConfig>): Promise<void> {
    try {
      await this.apiRequest('/api/shopify/config', 'POST', config);
      console.log('Shopify config saved to server');
    } catch (error) {
      console.error('Error saving Shopify config:', error);
      throw error;
    }
  }

  async clearShopifyConfig(): Promise<void> {
    try {
      await this.apiRequest('/api/shopify/config', 'DELETE');
      console.log('Shopify config cleared from server');
    } catch (error) {
      console.error('Error clearing Shopify config:', error);
      throw error;
    }
  }

  // Segments management
  async getSegments(): Promise<any[]> {
    try {
      const segments = await this.apiRequest('/api/segments');
      return segments || [];
    } catch (error) {
      console.error('Error fetching segments:', error);
      return [];
    }
  }

  async saveSegments(segments: any[]): Promise<void> {
    try {
      await this.apiRequest('/api/segments', 'POST', segments);
      console.log(`Saved ${segments.length} segments to server`);
    } catch (error) {
      console.error('Error saving segments:', error);
      throw error;
    }
  }

  // Background jobs management
  async getBackgroundJobs(): Promise<any[]> {
    try {
      const jobs = await this.apiRequest('/api/background-jobs');
      return jobs || [];
    } catch (error) {
      console.error('Error fetching background jobs:', error);
      return [];
    }
  }

  async createBackgroundJob(job: any): Promise<void> {
    try {
      await this.apiRequest('/api/background-jobs', 'POST', job);
      console.log('Background job created on server');
    } catch (error) {
      console.error('Error creating background job:', error);
      throw error;
    }
  }

  async updateBackgroundJob(jobId: string, updates: any): Promise<void> {
    try {
      await this.apiRequest(`/api/background-jobs/${jobId}`, 'PUT', updates);
      console.log('Background job updated on server');
    } catch (error) {
      console.error('Error updating background job:', error);
      throw error;
    }
  }



  // App settings management
  async getSetting(key: string): Promise<any> {
    try {
      const setting = await this.apiRequest(`/api/settings/${key}`);
      return setting?.value || null;
    } catch (error) {
      console.error(`Error fetching setting ${key}:`, error);
      return null;
    }
  }

  async saveSetting(key: string, value: any): Promise<void> {
    try {
      await this.apiRequest('/api/settings', 'POST', { key, value });
      console.log(`Setting ${key} saved to server`);
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      throw error;
    }
  }

  // Compatibility methods to match existing localStorage interface
  async getAppData(): Promise<AppData> {
    try {
      const [shopifyConfig, segments, lastSyncSetting] = await Promise.all([
        this.getShopifyConfig(),
        this.getSegments(),
        this.getSetting('lastSync')
      ]);

      return {
        shopifyConfig,
        segments,
        lastSync: lastSyncSetting
      };
    } catch (error) {
      console.error('Error fetching app data:', error);
      return {
        shopifyConfig: null,
        segments: [],
        lastSync: null
      };
    }
  }

  async saveAppData(data: Partial<AppData>): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (data.shopifyConfig) {
        promises.push(this.saveShopifyConfig(data.shopifyConfig));
      }

      if (data.segments) {
        promises.push(this.saveSegments(data.segments));
      }



      if (data.lastSync) {
        promises.push(this.saveSetting('lastSync', data.lastSync));
      }

      await Promise.all(promises);
      console.log('App data saved to server');
    } catch (error) {
      console.error('Error saving app data:', error);
      throw error;
    }
  }

  // Utility methods for backward compatibility
  async updateLastSync(): Promise<void> {
    await this.saveSetting('lastSync', new Date().toISOString());
  }

  async getLastSync(): Promise<string | null> {
    return await this.getSetting('lastSync');
  }

  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        this.clearShopifyConfig(),
        this.saveSegments([]),
        this.saveSetting('lastSync', null)
      ]);
      console.log('All app data cleared from server');
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  // Check if server storage is available
  async isStorageAvailable(): Promise<boolean> {
    try {
      // Test with a simple request to the server
      await this.apiRequest('/api/health');
      return true;
    } catch (error) {
      console.error('Server storage not available:', error);
      return false;
    }
  }

  // Debug method to check server storage status
  async debugStorage(): Promise<void> {
    console.log('=== Server Storage Debug Info ===');
    console.log('Base URL:', this.config.baseURL);
    
    try {
      const available = await this.isStorageAvailable();
      console.log('Server storage available:', available);
      
      if (available) {
        const appData = await this.getAppData();
        console.log('Current app data:', appData);
      }
    } catch (error) {
      console.error('Debug check failed:', error);
    }
    
    console.log('===============================');
  }
}

// Factory function to create server storage instance
export function createServerStorage(config: ServerStorageConfig): ServerStorageManager {
  return new ServerStorageManager(config);
}

// Default server storage instance for development
export const serverStorage = createServerStorage({
  baseURL: window.location.origin, // Use current origin
  username: 'admin123', // Actual working username
  password: 'admin123' // Actual working password
});

// Export for compatibility with existing code
export { ServerStorageManager }; 