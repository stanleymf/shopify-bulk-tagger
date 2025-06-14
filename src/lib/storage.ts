// Storage utility for data persistence
// Handles localStorage operations with proper error handling and type safety

export interface ShopifyConfig {
  shopDomain: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  isConnected: boolean;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  shopifyConfig: ShopifyConfig | null;
  segments: any[];
  rules: any[];
  lastSync: string | null;
}

class StorageManager {
  private readonly STORAGE_KEY = 'bulk_tagger_data';
  private readonly SHOPIFY_CONFIG_KEY = 'bulk_tagger_shopify_config';

  // Get all app data
  getAppData(): AppData {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading app data from storage:', error);
    }
    
    return {
      shopifyConfig: null,
      segments: [],
      rules: [],
      lastSync: null,
    };
  }

  // Save all app data
  saveAppData(data: Partial<AppData>): void {
    try {
      const existingData = this.getAppData();
      const updatedData = { ...existingData, ...data };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
    } catch (error) {
      console.error('Error saving app data to storage:', error);
      throw new Error('Failed to save data to storage');
    }
  }

  // Get Shopify configuration
  getShopifyConfig(): ShopifyConfig | null {
    try {
      const config = localStorage.getItem(this.SHOPIFY_CONFIG_KEY);
      if (config) {
        return JSON.parse(config);
      }
    } catch (error) {
      console.error('Error reading Shopify config from storage:', error);
    }
    return null;
  }

  // Save Shopify configuration
  saveShopifyConfig(config: Partial<ShopifyConfig>): void {
    try {
      const existingConfig = this.getShopifyConfig() || {
        shopDomain: '',
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        isConnected: false,
        createdAt: new Date().toISOString(),
      };
      
      const updatedConfig: ShopifyConfig = {
        ...existingConfig,
        ...config,
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem(this.SHOPIFY_CONFIG_KEY, JSON.stringify(updatedConfig));
    } catch (error) {
      console.error('Error saving Shopify config to storage:', error);
      throw new Error('Failed to save Shopify configuration');
    }
  }

  // Clear Shopify configuration
  clearShopifyConfig(): void {
    try {
      localStorage.removeItem(this.SHOPIFY_CONFIG_KEY);
    } catch (error) {
      console.error('Error clearing Shopify config from storage:', error);
    }
  }

  // Save segments data
  saveSegments(segments: any[]): void {
    this.saveAppData({ segments });
  }

  // Get segments data
  getSegments(): any[] {
    return this.getAppData().segments;
  }

  // Save rules data
  saveRules(rules: any[]): void {
    this.saveAppData({ rules });
  }

  // Get rules data
  getRules(): any[] {
    return this.getAppData().rules;
  }

  // Update last sync timestamp
  updateLastSync(): void {
    this.saveAppData({ lastSync: new Date().toISOString() });
  }

  // Get last sync timestamp
  getLastSync(): string | null {
    return this.getAppData().lastSync;
  }

  // Clear all app data
  clearAllData(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.SHOPIFY_CONFIG_KEY);
    } catch (error) {
      console.error('Error clearing all data from storage:', error);
    }
  }

  // Check if storage is available
  isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const storage = new StorageManager(); 