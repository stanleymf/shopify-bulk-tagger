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
  is_loading_count?: boolean;
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

// GraphQL Types
export interface GraphQLCustomerSegment {
  id: string;
  name: string;
  query?: string;
  createdAt: string;
  updatedAt: string;
  customerCount?: number;
}

export interface GraphQLCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

class ShopifyAPIService {
  private baseURL: string = '';
  private graphqlURL: string = '';
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
    this.graphqlURL = `https://${shopDomain}/admin/api/2024-01/graphql.json`;
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
      // Use the Cloudflare Workers proxy to avoid CORS issues
      const proxyUrl = '/api/shopify/proxy';
      const shopifyUrl = `${this.baseURL}/shop.json`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: shopifyUrl,
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
        }),
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

  // GraphQL query method
  private async graphqlQuery<T>(query: string, variables?: any): Promise<GraphQLResponse<T>> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      // Use the Cloudflare Workers proxy to avoid CORS issues
      const proxyUrl = '/api/shopify/proxy';
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: this.graphqlURL,
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
          body: {
            query,
            variables,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access token. Please reconnect your store.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your API permissions.');
        } else {
          throw new Error(`GraphQL request failed: ${response.status}`);
        }
      }

      const data: GraphQLResponse<T> = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        console.warn('GraphQL errors:', data.errors);
        throw new Error(`GraphQL errors: ${data.errors.map(e => e.message).join(', ')}`);
      }

      return data;
    } catch (error) {
      console.error('GraphQL query failed:', error);
      throw error;
    }
  }

  // Convert GraphQL customer segment to REST format
  private convertGraphQLSegmentToREST(graphqlSegment: GraphQLCustomerSegment): ShopifyCustomerSegment {
    return {
      id: parseInt(graphqlSegment.id.split('/').pop() || '0'),
      name: graphqlSegment.name,
      query: graphqlSegment.query,
      created_at: graphqlSegment.createdAt,
      updated_at: graphqlSegment.updatedAt,
      customer_count: graphqlSegment.customerCount,
    };
  }

  // Convert GraphQL customer to REST format
  private convertGraphQLCustomerToREST(graphqlCustomer: GraphQLCustomer): ShopifyCustomer {
    return {
      id: parseInt(graphqlCustomer.id.split('/').pop() || '0'),
      email: graphqlCustomer.email,
      first_name: graphqlCustomer.firstName,
      last_name: graphqlCustomer.lastName,
      tags: graphqlCustomer.tags.join(', '),
      created_at: graphqlCustomer.createdAt,
      updated_at: graphqlCustomer.updatedAt,
    };
  }

  // Get customer segments (try GraphQL first, fallback to REST)
  async getCustomerSegments(): Promise<ShopifyCustomerSegment[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    // Try GraphQL first
    try {
      console.log('Attempting to fetch customer segments via GraphQL...');
      const segments = await this.getCustomerSegmentsGraphQL();
      if (segments.length > 0) {
        console.log(`Successfully fetched ${segments.length} segments via GraphQL`);
        return segments;
      }
    } catch (error) {
      console.warn('GraphQL fetch failed:', error);
      throw error; // Don't fallback to REST since customer segments are not available via REST API
    }

    return [];
  }

  // Get customer segments using GraphQL (updated to use correct 'segments' query)
  private async getCustomerSegmentsGraphQL(): Promise<ShopifyCustomerSegment[]> {
    const query = `
      query {
        segments(first: 250) {
          edges {
            node {
              id
              name
              query
              creationDate
              lastEditDate
            }
          }
        }
      }
    `;

    const response = await this.graphqlQuery<{
      segments: {
        edges: Array<{
          node: {
            id: string;
            name: string;
            query: string;
            creationDate: string;
            lastEditDate: string;
          };
        }>;
      };
    }>(query);

    if (response.errors && response.errors.length > 0) {
      console.error('GraphQL errors:', response.errors);
      throw new Error(`GraphQL errors: ${response.errors.map(e => e.message).join(', ')}`);
    }

    if (!response.data?.segments) {
      return [];
    }

    const segments = response.data.segments.edges.map(edge => {
      const node = edge.node;
      // Convert GraphQL segment to REST format for compatibility
      return {
        id: parseInt(node.id.replace('gid://shopify/Segment/', '')),
        name: node.name,
        query: node.query,
        created_at: node.creationDate,
        updated_at: node.lastEditDate,
        customer_count: 0 // Not available in the basic query, would need separate query
      };
    });

    // Store segments in local storage
    storage.saveSegments(segments);
    storage.updateLastSync();
    
    return segments;
  }

  // Get customers within a specific segment
  async getSegmentCustomers(segmentId: number): Promise<ShopifyCustomer[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    // Try GraphQL first
    try {
      console.log(`Attempting to fetch customers for segment ${segmentId} via GraphQL...`);
      const customers = await this.getSegmentCustomersGraphQL(segmentId);
      console.log(`Successfully fetched ${customers.length} customers via GraphQL`);
      return customers;
    } catch (error) {
      console.warn('GraphQL fetch failed:', error);
      throw error; // Don't fallback to REST since customer segments are not available via REST API
    }
  }

  // Get segment customers using GraphQL (updated to use correct 'segment' query)
  private async getSegmentCustomersGraphQL(segmentId: number): Promise<ShopifyCustomer[]> {
    // Note: Direct customer listing from segments may not be available in current Shopify API
    // This is a limitation of the current Shopify GraphQL API for segments
    // For now, we'll return an empty array and suggest using customer search with segment criteria
    console.warn('Direct customer listing from segments is not available in current Shopify API');
    console.warn('Consider using customer search with segment criteria instead');
    return [];
    
    // The following code is commented out as the API structure may not be available:
    /*
    const query = `
      query($segmentId: ID!) {
        segment(id: $segmentId) {
          id
          name
          query
        }
      }
    `;

    const variables = { segmentId: `gid://shopify/Segment/${segmentId}` };
    
    const response = await this.graphqlQuery<{
      segment: {
        id: string;
        name: string;
        query: string;
      };
    }>(query, variables);

    if (response.errors && response.errors.length > 0) {
      console.error('GraphQL errors:', response.errors);
      throw new Error(`GraphQL errors: ${response.errors.map(e => e.message).join(', ')}`);
    }

    // Since direct customer listing may not be available, return empty array
    return [];
    */
  }

  // Update customer tags
  async updateCustomerTags(customerId: number, tags: string): Promise<ShopifyCustomer> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    // Try GraphQL first
    try {
      console.log(`Attempting to update tags for customer ${customerId} via GraphQL...`);
      const customer = await this.updateCustomerTagsGraphQL(customerId, tags);
      console.log(`Successfully updated customer ${customerId} via GraphQL`);
      return customer;
    } catch (error) {
      console.warn('GraphQL update failed, falling back to REST API:', error);
    }

    // Fallback to REST API
    try {
      console.log(`Updating tags for customer ${customerId} via REST API...`);
      return await this.updateCustomerTagsREST(customerId, tags);
    } catch (error) {
      console.error('Both GraphQL and REST failed:', error);
      throw error;
    }
  }

  // Update customer tags using GraphQL
  private async updateCustomerTagsGraphQL(customerId: number, tags: string): Promise<ShopifyCustomer> {
    const query = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
            tags
            createdAt
            updatedAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: `gid://shopify/Customer/${customerId}`,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      },
    };

    const response = await this.graphqlQuery<{
      customerUpdate: {
        customer: GraphQLCustomer;
        userErrors: Array<{
          field: string;
          message: string;
        }>;
      };
    }>(query, variables);

    if (response.data?.customerUpdate.userErrors && response.data.customerUpdate.userErrors.length > 0) {
      const errors = response.data.customerUpdate.userErrors.map(error => `${error.field}: ${error.message}`).join(', ');
      throw new Error(`GraphQL update failed: ${errors}`);
    }

    if (!response.data?.customerUpdate.customer) {
      throw new Error('No customer data returned from GraphQL update');
    }

    return this.convertGraphQLCustomerToREST(response.data.customerUpdate.customer);
  }

  // Update customer tags using REST API (existing implementation)
  private async updateCustomerTagsREST(customerId: number, tags: string): Promise<ShopifyCustomer> {
    try {
      const updateData: CustomerUpdateRequest = {
        customer: {
          id: customerId,
          tags: tags,
        },
      };

      // Use the Cloudflare Workers proxy to avoid CORS issues
      const proxyUrl = '/api/shopify/proxy';
      const shopifyUrl = `${this.baseURL}/customers/${customerId}.json`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: shopifyUrl,
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
          body: updateData,
        }),
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
      // Use the Cloudflare Workers proxy to avoid CORS issues
      const proxyUrl = '/api/shopify/proxy';
      const shopifyUrl = `${this.baseURL}/customers/${customerId}.json`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: shopifyUrl,
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
        }),
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
      // Use the Cloudflare Workers proxy to avoid CORS issues
      const proxyUrl = '/api/shopify/proxy';
      const shopifyUrl = `${this.baseURL}/customers/search.json?query=${encodeURIComponent(query)}`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: shopifyUrl,
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken!,
            'Content-Type': 'application/json',
          },
        }),
      });

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

  // Get customer count for a specific segment
  async getSegmentCustomerCount(segmentId: number): Promise<number> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      console.log(`Fetching customer count for segment ${segmentId}...`);
      
      const query = `
        query($segmentId: ID!) {
          customerSegmentMembers(segmentId: $segmentId, first: 1) {
            totalCount
          }
        }
      `;

      const variables = { segmentId: `gid://shopify/Segment/${segmentId}` };
      
      const response = await this.graphqlQuery<{
        customerSegmentMembers: {
          totalCount: number;
        };
      }>(query, variables);

      if (response.errors && response.errors.length > 0) {
        console.error('GraphQL errors:', response.errors);
        throw new Error(`GraphQL errors: ${response.errors.map(e => e.message).join(', ')}`);
      }

      const count = response.data?.customerSegmentMembers?.totalCount || 0;
      console.log(`Segment ${segmentId} has ${count} customers`);
      
      return count;
    } catch (error) {
      console.error(`Failed to get customer count for segment ${segmentId}:`, error);
      throw error;
    }
  }

  // Update stored segment with customer count
  updateSegmentCustomerCount(segmentId: number, count: number): void {
    const segments = this.getStoredSegments();
    const updatedSegments = segments.map(segment => 
      segment.id === segmentId 
        ? { ...segment, customer_count: count, is_loading_count: false }
        : segment
    );
    storage.saveSegments(updatedSegments);
  }

  // Set loading state for segment count
  setSegmentCountLoading(segmentId: number, isLoading: boolean): void {
    const segments = this.getStoredSegments();
    const updatedSegments = segments.map(segment => 
      segment.id === segmentId 
        ? { ...segment, is_loading_count: isLoading }
        : segment
    );
    storage.saveSegments(updatedSegments);
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPIService();