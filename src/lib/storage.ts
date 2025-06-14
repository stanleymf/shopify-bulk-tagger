// Storage utility for data persistence
// Handles localStorage operations with proper error handling and type safety
// Optimized for Cloudflare Workers environment

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
  monitoringRules?: any[];
  segmentSnapshots?: Array<[number, any]>;
  changeHistory?: any[];
}

class StorageManager {
  private readonly STORAGE_KEY = 'bulk_tagger_data';
  private readonly SHOPIFY_CONFIG_KEY = 'bulk_tagger_shopify_config';
  private readonly FALLBACK_KEY = 'bulk_tagger_fallback';
  private isStorageAvailableFlag: boolean | null = null;

  constructor() {
    // Test storage availability on initialization
    this.isStorageAvailableFlag = this.testStorageAvailability();
    console.log('Storage availability:', this.isStorageAvailableFlag);
  }

  // Test if localStorage is available and working
  private testStorageAvailability(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage not available');
        return false;
      }

      const testKey = '__storage_test__';
      const testValue = 'test_value_' + Date.now();
      
      // Test write
      localStorage.setItem(testKey, testValue);
      
      // Test read
      const readValue = localStorage.getItem(testKey);
      
      // Test delete
      localStorage.removeItem(testKey);
      
      // Verify the value was actually stored and retrieved
      const finalCheck = localStorage.getItem(testKey);
      
      if (readValue === testValue && finalCheck === null) {
        console.log('localStorage test passed');
        return true;
      } else {
        console.warn('localStorage test failed - data not persisting correctly');
        return false;
      }
    } catch (error) {
      console.error('localStorage test error:', error);
      return false;
    }
  }

  // Get all app data with fallback
  getAppData(): AppData {
    try {
      if (!this.isStorageAvailable()) {
        console.warn('Storage not available, using fallback');
        return this.getFallbackData();
      }

      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        console.log('Retrieved app data from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error reading app data from storage:', error);
      return this.getFallbackData();
    }
    
    return this.getFallbackData();
  }

  // Save all app data with fallback
  saveAppData(data: Partial<AppData>): void {
    try {
      if (!this.isStorageAvailable()) {
        console.warn('Storage not available, using fallback');
        this.saveFallbackData(data);
        return;
      }

      const existingData = this.getAppData();
      const updatedData = { ...existingData, ...data };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
      console.log('Saved app data to localStorage:', updatedData);
      
      // Also save to fallback
      this.saveFallbackData(updatedData);
    } catch (error) {
      console.error('Error saving app data to storage:', error);
      // Try fallback
      this.saveFallbackData(data);
    }
  }

  // Get Shopify configuration with fallback
  getShopifyConfig(): ShopifyConfig | null {
    try {
      if (!this.isStorageAvailable()) {
        console.warn('Storage not available, using fallback for Shopify config');
        return this.getFallbackShopifyConfig();
      }

      const config = localStorage.getItem(this.SHOPIFY_CONFIG_KEY);
      if (config) {
        const parsed = JSON.parse(config);
        console.log('Retrieved Shopify config from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error reading Shopify config from storage:', error);
      return this.getFallbackShopifyConfig();
    }
    return this.getFallbackShopifyConfig();
  }

  // Save Shopify configuration with fallback
  saveShopifyConfig(config: Partial<ShopifyConfig>): void {
    try {
      if (!this.isStorageAvailable()) {
        console.warn('Storage not available, using fallback for Shopify config');
        this.saveFallbackShopifyConfig(config);
        return;
      }

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
      console.log('Saved Shopify config to localStorage:', updatedConfig);
      
      // Also save to fallback
      this.saveFallbackShopifyConfig(updatedConfig);
    } catch (error) {
      console.error('Error saving Shopify config to storage:', error);
      // Try fallback
      this.saveFallbackShopifyConfig(config);
    }
  }

  // Fallback storage using sessionStorage
  private getFallbackData(): AppData {
    try {
      const data = sessionStorage.getItem(this.FALLBACK_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading fallback data:', error);
    }
    
    return {
      shopifyConfig: null,
      segments: [],
      rules: [],
      lastSync: null,
    };
  }

  private saveFallbackData(data: Partial<AppData>): void {
    try {
      const existingData = this.getFallbackData();
      const updatedData = { ...existingData, ...data };
      sessionStorage.setItem(this.FALLBACK_KEY, JSON.stringify(updatedData));
      console.log('Saved data to fallback storage:', updatedData);
    } catch (error) {
      console.error('Error saving fallback data:', error);
    }
  }

  private getFallbackShopifyConfig(): ShopifyConfig | null {
    try {
      const data = this.getFallbackData();
      return data.shopifyConfig;
    } catch (error) {
      console.error('Error reading fallback Shopify config:', error);
      return null;
    }
  }

  private saveFallbackShopifyConfig(config: Partial<ShopifyConfig>): void {
    try {
      const existingData = this.getFallbackData();
      const existingConfig = existingData.shopifyConfig || {
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
      
      this.saveFallbackData({ shopifyConfig: updatedConfig });
    } catch (error) {
      console.error('Error saving fallback Shopify config:', error);
    }
  }

  // Clear Shopify configuration
  clearShopifyConfig(): void {
    try {
      if (this.isStorageAvailable()) {
        localStorage.removeItem(this.SHOPIFY_CONFIG_KEY);
      }
      // Also clear fallback
      const fallbackData = this.getFallbackData();
      const { shopifyConfig, ...restData } = fallbackData;
      this.saveFallbackData(restData);
      console.log('Cleared Shopify configuration');
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
      if (this.isStorageAvailable()) {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.SHOPIFY_CONFIG_KEY);
      }
      // Also clear fallback
      sessionStorage.removeItem(this.FALLBACK_KEY);
      console.log('Cleared all app data');
    } catch (error) {
      console.error('Error clearing all data from storage:', error);
    }
  }

  // Check if storage is available
  isStorageAvailable(): boolean {
    if (this.isStorageAvailableFlag === null) {
      this.isStorageAvailableFlag = this.testStorageAvailability();
    }
    return this.isStorageAvailableFlag;
  }

  // Debug method to check storage status
  debugStorage(): void {
    console.log('=== Storage Debug Info ===');
    console.log('Storage available:', this.isStorageAvailable());
    console.log('localStorage available:', typeof window !== 'undefined' && !!window.localStorage);
    console.log('sessionStorage available:', typeof window !== 'undefined' && !!window.sessionStorage);
    
    if (this.isStorageAvailable()) {
      console.log('localStorage Shopify config:', localStorage.getItem(this.SHOPIFY_CONFIG_KEY));
      console.log('localStorage app data:', localStorage.getItem(this.STORAGE_KEY));
    }
    
    console.log('sessionStorage fallback:', sessionStorage.getItem(this.FALLBACK_KEY));
    console.log('Current Shopify config:', this.getShopifyConfig());
    console.log('Current app data:', this.getAppData());
    console.log('========================');
  }
}

export const storage = new StorageManager(); 