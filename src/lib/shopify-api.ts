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

  // GraphQL query method
  private async graphqlQuery<T>(query: string, variables?: any): Promise<GraphQLResponse<T>> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized. Please connect your store first.');
    }

    try {
      const response = await fetch(this.graphqlURL, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
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

  // Get all customer segments from Shopify using GraphQL first, then REST fallback
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
      console.warn('GraphQL fetch failed, falling back to REST API:', error);
    }

    // Fallback to REST API
    try {
      console.log('Fetching customer segments via REST API...');
      return await this.getCustomerSegmentsREST();
    } catch (error) {
      console.error('Both GraphQL and REST failed:', error);
      throw error;
    }
  }

  // Get customer segments using GraphQL
  private async getCustomerSegmentsGraphQL(): Promise<ShopifyCustomerSegment[]> {
    const query = `
      query {
        customerSegments(first: 250) {
          edges {
            node {
              id
              name
              query
              createdAt
              updatedAt
              customerCount
            }
          }
        }
      }
    `;

    const response = await this.graphqlQuery<{
      customerSegments: {
        edges: Array<{
          node: GraphQLCustomerSegment;
        }>;
      };
    }>(query);

    if (!response.data?.customerSegments) {
      return [];
    }

    const segments = response.data.customerSegments.edges.map(edge => 
      this.convertGraphQLSegmentToREST(edge.node)
    );

    // Store segments in local storage
    storage.saveSegments(segments);
    storage.updateLastSync();
    
    return segments;
  }

  // Get customer segments using REST API (existing implementation)
  private async getCustomerSegmentsREST(): Promise<ShopifyCustomerSegment[]> {
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

    // Try GraphQL first
    try {
      console.log(`Attempting to fetch customers for segment ${segmentId} via GraphQL...`);
      const customers = await this.getSegmentCustomersGraphQL(segmentId);
      if (customers.length > 0) {
        console.log(`Successfully fetched ${customers.length} customers via GraphQL`);
        return customers;
      }
    } catch (error) {
      console.warn('GraphQL fetch failed, falling back to REST API:', error);
    }

    // Fallback to REST API
    try {
      console.log(`Fetching customers for segment ${segmentId} via REST API...`);
      return await this.getSegmentCustomersREST(segmentId);
    } catch (error) {
      console.error('Both GraphQL and REST failed:', error);
      throw error;
    }
  }

  // Get segment customers using GraphQL
  private async getSegmentCustomersGraphQL(segmentId: number): Promise<ShopifyCustomer[]> {
    const query = `
      query($segmentId: ID!) {
        customerSegment(id: $segmentId) {
          customers(first: 250) {
            edges {
              node {
                id
                email
                firstName
                lastName
                tags
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `;

    const variables = { segmentId: `gid://shopify/CustomerSegment/${segmentId}` };
    
    const response = await this.graphqlQuery<{
      customerSegment: {
        customers: {
          edges: Array<{
            node: GraphQLCustomer;
          }>;
        };
      };
    }>(query, variables);

    const customers = response.data?.customerSegment?.customers.edges.map(edge => edge.node) || [];
    return customers.map(customer => this.convertGraphQLCustomerToREST(customer));
  }

  // Get segment customers using REST API (existing implementation)
  private async getSegmentCustomersREST(segmentId: number): Promise<ShopifyCustomer[]> {
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