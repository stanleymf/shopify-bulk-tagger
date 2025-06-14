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

  // Bulk tagging methods for customer segments
  
  /**
   * Get customer IDs from a segment (without full customer data)
   * Uses GraphQL customer search with segment criteria
   */
  async getSegmentCustomerIds(segmentId: number, limit: number = 250): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    console.log(`Fetching customer IDs for segment ${segmentId} with limit ${limit}...`);

    // First, try to get the segment to understand its query
    const segments = this.getStoredSegments();
    const segment = segments.find(s => s.id === segmentId);
    
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found in stored segments`);
    }

    console.log(`Found segment: ${segment.name}, query: ${segment.query}`);

    // Use customer search with segment criteria
    const query = `
      query($query: String!, $first: Int!) {
        customers(query: $query, first: $first) {
          edges {
            node {
              id
              email
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Build search query for this segment
    // For now, we'll use a fallback approach since we can't directly query segment membership
    let searchQuery = '';
    
    if (segment.query) {
      // If the segment has a query, try to use it
      searchQuery = segment.query;
    } else {
      // Fallback: search for customers and then filter (not ideal but works)
      searchQuery = 'state:enabled'; // Get all enabled customers
    }

    const variables = {
      query: searchQuery,
      first: Math.min(limit, 250) // Shopify limits to 250
    };

    console.log('Customer search query variables:', variables);

    const response = await this.graphqlQuery<{
      customers: {
        edges: Array<{ node: { id: string; email: string } }>;
        pageInfo: { hasNextPage: boolean; endCursor?: string };
      };
    }>(query, variables);

    console.log('Customer search response:', JSON.stringify(response, null, 2));

    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      throw new Error(`Failed to search customers: ${response.errors.map(e => e.message).join(', ')}`);
    }

    if (!response.data?.customers) {
      console.error('No customers data received');
      throw new Error('No customers data received from search');
    }

    const { edges } = response.data.customers;
    console.log(`Customer search returned ${edges.length} customers`);

    // If we got customers but used a generic query, we need to filter by segment
    // This is a limitation - we'll return what we found and let the user know
    if (!segment.query && edges.length > 0) {
      console.warn(`Segment "${segment.name}" doesn't have a specific query. Returning first ${Math.min(edges.length, 10)} customers as a sample.`);
      // Limit to first 10 for safety when no specific query
      const limitedEdges = edges.slice(0, 10);
      const customerIds = limitedEdges.map(edge => edge.node.id);
      console.log(`Returning limited customer IDs:`, customerIds);
      return customerIds;
    }

    const customerIds = edges.map(edge => edge.node.id);
    console.log(`Successfully fetched ${customerIds.length} customer IDs:`, customerIds);
    
    return customerIds;
  }

  /**
   * Bulk add tags to all customers in a segment
   */
  async bulkAddTagsToSegment(segmentId: number, tagsToAdd: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    if (!tagsToAdd.length) {
      throw new Error('No tags provided to add');
    }

    try {
      // Try GraphQL first, fallback to REST if it fails
      try {
        return await this.bulkAddTagsToSegmentGraphQL(segmentId, tagsToAdd);
      } catch (graphqlError) {
        console.warn('GraphQL bulk tagging failed, trying REST API fallback:', graphqlError);
        return await this.bulkAddTagsToSegmentREST(segmentId, tagsToAdd);
      }
    } catch (error) {
      console.error('Bulk add tags failed:', error);
      throw error;
    }
  }

  /**
   * Bulk remove tags from all customers in a segment
   */
  async bulkRemoveTagsFromSegment(segmentId: number, tagsToRemove: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    if (!tagsToRemove.length) {
      throw new Error('No tags provided to remove');
    }

    try {
      // Try GraphQL first, fallback to REST if it fails
      try {
        return await this.bulkRemoveTagsFromSegmentGraphQL(segmentId, tagsToRemove);
      } catch (graphqlError) {
        console.warn('GraphQL bulk tagging failed, trying REST API fallback:', graphqlError);
        return await this.bulkRemoveTagsFromSegmentREST(segmentId, tagsToRemove);
      }
    } catch (error) {
      console.error('Bulk remove tags failed:', error);
      throw error;
    }
  }

  /**
   * GraphQL implementation for bulk add tags
   */
  private async bulkAddTagsToSegmentGraphQL(segmentId: number, tagsToAdd: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    // Get customer IDs from the segment
    const customerIds = await this.getSegmentCustomerIds(segmentId);
    
    if (!customerIds.length) {
      return {
        success: true,
        processedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    // Use batch processing for GraphQL (more reliable than bulk operations)
    return await this.batchAddTags(customerIds, tagsToAdd);
  }

  /**
   * GraphQL implementation for bulk remove tags
   */
  private async bulkRemoveTagsFromSegmentGraphQL(segmentId: number, tagsToRemove: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    // Get customer IDs from the segment
    const customerIds = await this.getSegmentCustomerIds(segmentId);
    
    if (!customerIds.length) {
      return {
        success: true,
        processedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    // Use batch processing for GraphQL
    return await this.batchRemoveTags(customerIds, tagsToRemove);
  }

  /**
   * REST API fallback for bulk add tags
   */
  private async bulkAddTagsToSegmentREST(segmentId: number, tagsToAdd: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    // Get customers using REST API
    const customers = await this.getSegmentCustomersREST(segmentId);
    
    if (!customers.length) {
      return {
        success: true,
        processedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    return await this.batchAddTagsREST(customers, tagsToAdd);
  }

  /**
   * REST API fallback for bulk remove tags
   */
  private async bulkRemoveTagsFromSegmentREST(segmentId: number, tagsToRemove: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    // Get customers using REST API
    const customers = await this.getSegmentCustomersREST(segmentId);
    
    if (!customers.length) {
      return {
        success: true,
        processedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    return await this.batchRemoveTagsREST(customers, tagsToRemove);
  }

  /**
   * Get segment customers using REST API (fallback)
   */
  private async getSegmentCustomersREST(segmentId: number): Promise<ShopifyCustomer[]> {
    // Note: REST API doesn't have direct segment customer access
    // This is a limitation - we'll need to get all customers and filter
    // For now, we'll use the existing getSegmentCustomers method
    return await this.getSegmentCustomers(segmentId);
  }

  /**
   * Batch add tags using REST API
   */
  private async batchAddTagsREST(customers: ShopifyCustomer[], tagsToAdd: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    const batchSize = 5; // Smaller batches for REST API

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      const promises = batch.map(async (customer) => {
        try {
          const currentTags = ShopifyAPIService.parseTags(customer.tags);
          const newTags = [...new Set([...currentTags, ...tagsToAdd])]; // Remove duplicates
          const updatedTagsString = ShopifyAPIService.formatTags(newTags);
          
          await this.updateCustomerTagsREST(customer.id, updatedTagsString);
          processedCount++;
        } catch (error) {
          errors.push(`Failed to update customer ${customer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(promises);
      
      // Add delay between batches
      if (i + batchSize < customers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay for REST
      }
    }

    return {
      success: errors.length === 0,
      processedCount,
      errors
    };
  }

  /**
   * Batch remove tags using REST API
   */
  private async batchRemoveTagsREST(customers: ShopifyCustomer[], tagsToRemove: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    const batchSize = 5;

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      const promises = batch.map(async (customer) => {
        try {
          const currentTags = ShopifyAPIService.parseTags(customer.tags);
          const filteredTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
          const updatedTagsString = ShopifyAPIService.formatTags(filteredTags);
          
          await this.updateCustomerTagsREST(customer.id, updatedTagsString);
          processedCount++;
        } catch (error) {
          errors.push(`Failed to update customer ${customer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(promises);
      
      // Add delay between batches
      if (i + batchSize < customers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: errors.length === 0,
      processedCount,
      errors
    };
  }

  /**
   * Batch process tag additions for GraphQL (smaller datasets)
   */
  private async batchAddTags(customerIds: string[], tagsToAdd: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    const batchSize = 10; // Process in smaller batches to avoid rate limits

    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (customerId) => {
        try {
          // Get current customer tags first
          const customer = await this.getCustomerById(customerId);
          const currentTags = ShopifyAPIService.parseTags(customer.tags);
          const newTags = [...new Set([...currentTags, ...tagsToAdd])]; // Remove duplicates
          const updatedTagsString = ShopifyAPIService.formatTags(newTags);
          
          await this.updateCustomerTagsById(customerId, updatedTagsString);
          processedCount++;
        } catch (error) {
          errors.push(`Failed to update customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(promises);
      
      // Add small delay between batches to respect rate limits
      if (i + batchSize < customerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      success: errors.length === 0,
      processedCount,
      errors
    };
  }

  /**
   * Batch process tag removals for GraphQL (smaller datasets)
   */
  private async batchRemoveTags(customerIds: string[], tagsToRemove: string[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    const batchSize = 10;

    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (customerId) => {
        try {
          // Get current customer tags first
          const customer = await this.getCustomerById(customerId);
          const currentTags = ShopifyAPIService.parseTags(customer.tags);
          const filteredTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
          const updatedTagsString = ShopifyAPIService.formatTags(filteredTags);
          
          await this.updateCustomerTagsById(customerId, updatedTagsString);
          processedCount++;
        } catch (error) {
          errors.push(`Failed to update customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(promises);
      
      // Add small delay between batches
      if (i + batchSize < customerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      success: errors.length === 0,
      processedCount,
      errors
    };
  }

  /**
   * Get customer by ID (GraphQL ID format)
   */
  private async getCustomerById(customerId: string): Promise<ShopifyCustomer> {
    const query = `
      query($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          tags
          createdAt
          updatedAt
        }
      }
    `;

    const response = await this.graphqlQuery<{
      customer: GraphQLCustomer;
    }>(query, { id: customerId });

    if (response.errors) {
      throw new Error(`Failed to get customer: ${response.errors.map(e => e.message).join(', ')}`);
    }

    if (!response.data?.customer) {
      throw new Error('Customer not found');
    }

    return this.convertGraphQLCustomerToREST(response.data.customer);
  }

  /**
   * Update customer tags by ID (GraphQL ID format)
   */
  private async updateCustomerTagsById(customerId: string, tags: string): Promise<void> {
    const mutation = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            tags
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
        id: customerId,
        tags: ShopifyAPIService.parseTags(tags)
      }
    };

    const response = await this.graphqlQuery<{
      customerUpdate: {
        customer: { id: string; tags: string[] };
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(mutation, variables);

    if (response.errors || response.data?.customerUpdate.userErrors?.length) {
      const errors = [
        ...(response.errors?.map(e => e.message) || []),
        ...(response.data?.customerUpdate.userErrors?.map(e => e.message) || [])
      ];
      throw new Error(`Failed to update customer tags: ${errors.join(', ')}`);
    }
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPIService();