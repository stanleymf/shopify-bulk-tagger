// Shopify API Service Layer
// Handles all interactions with Shopify APIs for customer segments and tagging

import { storage, ShopifyConfig } from './storage';

export interface ShopifyCustomerSegment {
  id: number;
  name: string;
  query?: string;
  created_at: string;
  updated_at: string;
  customer_count?: number;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyAPIResponse<T> {
  data: T;
  errors?: string[];
}

export interface CustomerSegmentResponse {
  customer_segments: ShopifyCustomerSegment[];
}

export interface CustomerResponse {
  customers: ShopifyCustomer[];
}

export interface CustomerUpdateRequest {
  customer: {
    id: number;
    tags: string;
  };
}

export interface ShopifyAPIError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

class ShopifyAPIService {
  private baseURL: string = '';
  private accessToken: string | null = null;
  private shopDomain: string | null = null;
  private isInitializedFlag: boolean = false;

  constructor() {
    // Try to initialize from stored configuration
    this.initializeFromStorage();
  }

  // Initialize from stored configuration
  private initializeFromStorage(): void {
    try {
      const config = storage.getShopifyConfig();
      if (config && config.isConnected && config.shopDomain && config.accessToken) {
        this.initialize(config.shopDomain, config.accessToken);
      }
    } catch (error) {
      console.error('Failed to initialize from storage:', error);
    }
  }

  // Initialize the API service with shop domain and access token
  initialize(shopDomain: string, accessToken: string): void {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.baseURL = `https://${shopDomain}/admin/api/2024-01`;
    this.isInitializedFlag = true;
  }

  // Check if the service is properly initialized
  isInitialized(): boolean {
    return this.isInitializedFlag && !!(this.shopDomain && this.accessToken);
  }

  // Test connection to Shopify API
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    try {
      const response = await fetch(`${this.baseURL}/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken!,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please check your credentials.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your API permissions.');
        } else {
          throw new Error(`API request failed with status: ${response.status}`);
        }
      }

      const data = await response.json();
      return !!data.shop;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  }

  // Get all customer segments from Shopify
  async getCustomerSegments(): Promise<ShopifyCustomerSegment[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      const response = await fetch(`${this.baseURL}/customer_segments.json`, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken!,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please reconnect your store.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your API permissions for customer segments.');
        } else {
          throw new Error(`Failed to fetch customer segments: ${response.status}`);
        }
      }

      const data: CustomerSegmentResponse = await response.json();
      
      // Store segments in local storage
      storage.saveSegments(data.customer_segments);
      storage.updateLastSync();
      
      return data.customer_segments;
    } catch (error) {
      console.error('Error fetching customer segments:', error);
      throw error;
    }
  }

  // Get customers within a specific segment
  async getSegmentCustomers(segmentId: number): Promise<ShopifyCustomer[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      const response = await fetch(
        `${this.baseURL}/customer_segments/${segmentId}/customers.json`,
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please reconnect your store.');
        } else if (response.status === 404) {
          throw new Error(`Customer segment ${segmentId} not found.`);
        } else {
          throw new Error(`Failed to fetch segment customers: ${response.status}`);
        }
      }

      const data: CustomerResponse = await response.json();
      return data.customers;
    } catch (error) {
      console.error(`Error fetching customers for segment ${segmentId}:`, error);
      throw error;
    }
  }

  // Update customer tags
  async updateCustomerTags(customerId: number, tags: string): Promise<ShopifyCustomer> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      const updateData: CustomerUpdateRequest = {
        customer: {
          id: customerId,
          tags: tags,
        },
      };

      const response = await fetch(`${this.baseURL}/customers/${customerId}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': this.accessToken!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please reconnect your store.');
        } else if (response.status === 404) {
          throw new Error(`Customer ${customerId} not found.`);
        } else if (response.status === 422) {
          throw new Error('Invalid tag format. Please check your tag syntax.');
        } else {
          throw new Error(`Failed to update customer tags: ${response.status}`);
        }
      }

      const data: { customer: ShopifyCustomer } = await response.json();
      return data.customer;
    } catch (error) {
      console.error(`Error updating tags for customer ${customerId}:`, error);
      throw error;
    }
  }

  // Batch update customer tags for multiple customers
  async batchUpdateCustomerTags(
    customerUpdates: Array<{ id: number; tags: string }>
  ): Promise<ShopifyCustomer[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    const results: ShopifyCustomer[] = [];
    const batchSize = 10; // Process in batches to respect rate limits
    const errors: string[] = [];

    for (let i = 0; i < customerUpdates.length; i += batchSize) {
      const batch = customerUpdates.slice(i, i + batchSize);
      
      // Process batch with rate limiting
      const batchPromises = batch.map(async (update) => {
        try {
          const result = await this.updateCustomerTags(update.id, update.tags);
          return { success: true, data: result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Customer ${update.id}: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Collect successful results
      batchResults.forEach(result => {
        if (result.success && result.data) {
          results.push(result.data);
        }
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < customerUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    }

    // If there were errors, throw them
    if (errors.length > 0) {
      throw new Error(`Batch update completed with errors: ${errors.join('; ')}`);
    }

    return results;
  }

  // Get customer by ID
  async getCustomer(customerId: number): Promise<ShopifyCustomer> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      const response = await fetch(`${this.baseURL}/customers/${customerId}.json`, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken!,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please reconnect your store.');
        } else if (response.status === 404) {
          throw new Error(`Customer ${customerId} not found.`);
        } else {
          throw new Error(`Failed to fetch customer: ${response.status}`);
        }
      }

      const data: { customer: ShopifyCustomer } = await response.json();
      return data.customer;
    } catch (error) {
      console.error(`Error fetching customer ${customerId}:`, error);
      throw error;
    }
  }

  // Search customers with specific criteria
  async searchCustomers(query: string): Promise<ShopifyCustomer[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      const response = await fetch(
        `${this.baseURL}/customers/search.json?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please reconnect your store.');
        } else {
          throw new Error(`Failed to search customers: ${response.status}`);
        }
      }

      const data: CustomerResponse = await response.json();
      return data.customers;
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  // Get stored segments from local storage
  getStoredSegments(): ShopifyCustomerSegment[] {
    return storage.getSegments();
  }

  // Get last sync timestamp
  getLastSync(): string | null {
    return storage.getLastSync();
  }

  // Clear stored data
  clearStoredData(): void {
    storage.saveSegments([]);
    storage.saveAppData({ lastSync: null });
  }

  // Utility methods for tag manipulation
  static parseTags(tagsString: string): string[] {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  static formatTags(tags: string[]): string {
    return tags.join(', ');
  }

  static addTags(existingTags: string, newTags: string[]): string {
    const existing = this.parseTags(existingTags);
    const unique = [...new Set([...existing, ...newTags])];
    return this.formatTags(unique);
  }

  static removeTags(existingTags: string, tagsToRemove: string[]): string {
    const existing = this.parseTags(existingTags);
    const filtered = existing.filter(tag => !tagsToRemove.includes(tag));
    return this.formatTags(filtered);
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPIService(); 