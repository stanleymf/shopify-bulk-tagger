// Shopify API Service Layer
// Handles all interactions with Shopify APIs for customer segments and tagging

import { migrationService } from './migration-service';

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
    this.initializeFromStorage().catch(error => {
      console.error('Failed to initialize Shopify API from storage:', error);
    });
  }

  // Initialize from stored configuration using migration service
  private async initializeFromStorage(): Promise<void> {
    try {
      const config = await migrationService.getShopifyConfig();
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
    await migrationService.saveSegmentsAsync(segments);
    await migrationService.updateLastSyncAsync();
    
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
  async getStoredSegments(): Promise<ShopifyCustomerSegment[]> {
    return await migrationService.getSegmentsAsync();
  }

  // Get stored segments synchronously for UI components
  getStoredSegmentsSync(): ShopifyCustomerSegment[] {
    return migrationService.getSegments();
  }

  // Get last sync timestamp
  async getLastSync(): Promise<string | null> {
    return await migrationService.getLastSyncAsync();
  }

  // Get last sync timestamp synchronously for UI components
  getLastSyncSync(): string | null {
    return migrationService.getLastSync();
  }

  // Clear stored data
  async clearStoredData(): Promise<void> {
    await migrationService.saveSegmentsAsync([]);
    await migrationService.saveAppDataAsync({ lastSync: null });
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

  /**
   * Ensure customer ID is in the correct GID format for GraphQL
   */
  static ensureCustomerGID(customerId: string | number): string {
    const idStr = customerId.toString();
    if (idStr.startsWith('gid://shopify/Customer/')) {
      return idStr;
    }
    return `gid://shopify/Customer/${idStr}`;
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
  async updateSegmentCustomerCount(segmentId: number, count: number): Promise<void> {
    const segments = await this.getStoredSegments();
    const updatedSegments = segments.map(segment => 
      segment.id === segmentId 
        ? { ...segment, customer_count: count, is_loading_count: false }
        : segment
    );
    await migrationService.saveSegmentsAsync(updatedSegments);
  }

  // Set loading state for segment count
  async setSegmentCountLoading(segmentId: number, isLoading: boolean): Promise<void> {
    const segments = await this.getStoredSegments();
    const updatedSegments = segments.map(segment => 
      segment.id === segmentId 
        ? { ...segment, is_loading_count: isLoading }
        : segment
    );
    await migrationService.saveSegmentsAsync(updatedSegments);
  }

  // Bulk tagging methods for customer segments
  
  /**
   * Translate segment query syntax to customer search syntax
   * Shopify segments use different query syntax than customer search
   */
  private translateSegmentQueryToCustomerSearch(segmentQuery: string): string {
    if (!segmentQuery) {
      return 'state:enabled'; // Default fallback
    }

    console.log(`Translating segment query: "${segmentQuery}"`);

    // Common segment query patterns and their customer search equivalents
    const translations: Array<{ pattern: RegExp; replacement: string | ((match: string, ...groups: string[]) => string) }> = [
      // Email domain queries
      { 
        pattern: /customer_email_domain\s*=\s*'([^']+)'/gi, 
        replacement: (match, domain) => `email:*@${domain}` 
      },
      { 
        pattern: /customer_email_domain\s*=\s*"([^"]+)"/gi, 
        replacement: (match, domain) => `email:*@${domain}` 
      },
      
      // Email queries
      { 
        pattern: /customer_email\s*=\s*'([^']+)'/gi, 
        replacement: (match, email) => `email:${email}` 
      },
      { 
        pattern: /customer_email\s*=\s*"([^"]+)"/gi, 
        replacement: (match, email) => `email:${email}` 
      },
      
      // Customer state queries
      { 
        pattern: /customer_state\s*=\s*'enabled'/gi, 
        replacement: 'state:enabled' 
      },
      { 
        pattern: /customer_state\s*=\s*'disabled'/gi, 
        replacement: 'state:disabled' 
      },
      
      // Tag queries
      { 
        pattern: /customer_tags\s*contains\s*'([^']+)'/gi, 
        replacement: (match, tag) => `tag:${tag}` 
      },
      { 
        pattern: /customer_tags\s*contains\s*"([^"]+)"/gi, 
        replacement: (match, tag) => `tag:${tag}` 
      },
      
      // Location queries
      { 
        pattern: /customer_city\s*=\s*'([^']+)'/gi, 
        replacement: (match, city) => `address1:${city}` 
      },
      { 
        pattern: /customer_country\s*=\s*'([^']+)'/gi, 
        replacement: (match, country) => `country:${country}` 
      },
      
      // Date queries (simplified)
      { 
        pattern: /customer_created_at\s*>\s*'([^']+)'/gi, 
        replacement: (match, date) => `created_at:>${date}` 
      },
      { 
        pattern: /customer_updated_at\s*>\s*'([^']+)'/gi, 
        replacement: (match, date) => `updated_at:>${date}` 
      },
    ];

    let translatedQuery = segmentQuery;

    // Apply translations
    for (const { pattern, replacement } of translations) {
      if (typeof replacement === 'function') {
        translatedQuery = translatedQuery.replace(pattern, replacement);
      } else {
        translatedQuery = translatedQuery.replace(pattern, replacement);
      }
    }

    // If no translation was applied, try some fallback approaches
    if (translatedQuery === segmentQuery) {
      console.warn(`No translation found for segment query: "${segmentQuery}"`);
      
      // Try to extract email domain from common patterns
      const emailDomainMatch = segmentQuery.match(/['"]([^'"]*@[^'"]+)['"]/);
      if (emailDomainMatch) {
        const email = emailDomainMatch[1];
        if (email.includes('@')) {
          const domain = email.split('@')[1];
          translatedQuery = `email:*@${domain}`;
          console.log(`Extracted email domain pattern: ${translatedQuery}`);
        }
      }
      
      // If still no match, throw an error instead of using a fallback
      // This will help identify segments that can't be properly monitored
      if (translatedQuery === segmentQuery) {
        console.error(`❌ Cannot translate segment query: "${segmentQuery}"`);
        console.error(`❌ This segment cannot be monitored for changes due to unsupported query syntax`);
        throw new Error(`Unsupported segment query syntax: "${segmentQuery}". This segment cannot be monitored for real-time changes.`);
      }
    }

    console.log(`Translated query: "${segmentQuery}" -> "${translatedQuery}"`);
    return translatedQuery;
  }

  /**
   * Get customer IDs from a segment (without full customer data)
   * Uses direct GraphQL segment customer access - let Shopify handle the query
   */
  async getSegmentCustomerIds(segmentId: number, limit: number = 30000): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    console.log(`🔍 Fetching customer IDs for segment ${segmentId} with limit ${limit} using direct segment access...`);

    const query = `
      query getSegmentCustomers($segmentId: ID!, $first: Int!, $after: String) {
        customerSegment(id: $segmentId) {
          customers(first: $first, after: $after) {
            edges {
              node {
                id
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const customerIds: string[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    const batchSize = Math.min(250, limit); // GraphQL limit is 250

    console.log(`🔍 Starting customer fetch loop for segment ${segmentId}`);

    while (hasNextPage && customerIds.length < limit) {
      const variables: any = {
        segmentId: `gid://shopify/CustomerSegment/${segmentId}`,
        first: Math.min(batchSize, limit - customerIds.length)
      };

      if (cursor) {
        variables.after = cursor;
      }

      console.log(`🔍 Making GraphQL query for segment ${segmentId} with variables:`, JSON.stringify(variables, null, 2));

      try {
        console.log(`🔍 About to call graphqlQuery for segment ${segmentId}...`);
        const response = await this.graphqlQuery<{
          customerSegment: {
            customers: {
              edges: Array<{ node: { id: string } }>;
              pageInfo: { hasNextPage: boolean; endCursor?: string };
            };
          };
        }>(query, variables);

        if (response.errors) {
          console.error('GraphQL errors:', response.errors);
          throw new Error(`Failed to fetch segment customers: ${response.errors.map(e => e.message).join(', ')}`);
        }

        console.log(`🔍 GraphQL query completed for segment ${segmentId}. Response:`, JSON.stringify(response.data, null, 2));
        
        if (!response.data?.customerSegment?.customers?.edges) {
          console.warn(`⚠️ No customers found for segment ${segmentId}. Data structure:`, JSON.stringify(response.data, null, 2));
          break;
        }

        const edges = response.data.customerSegment.customers.edges;
        const batchIds = edges.map((edge: any) => edge.node.id); // Keep full GID format
        customerIds.push(...batchIds);

        hasNextPage = response.data.customerSegment.customers.pageInfo.hasNextPage;
        cursor = response.data.customerSegment.customers.pageInfo.endCursor || null;

        console.log(`✅ Fetched ${batchIds.length} customer IDs (total: ${customerIds.length}) for segment ${segmentId}`);

        // Add delay between pages to respect rate limits
        if (hasNextPage) {
          const delay = limit > 10000 ? 300 : 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`💥 ERROR fetching segment customers via direct access for segment ${segmentId}:`, error);
        console.log(`🔄 Attempting fallback to customer search method for segment ${segmentId}...`);
        
        // Try fallback: get segment info and use customer search
        try {
          const segments = await this.getCustomerSegments();
          const segment = segments.find(s => s.id === segmentId);
          
          if (!segment || !segment.query) {
            console.error(`💥 Segment ${segmentId} not found or has no query for customer search fallback`);
            throw new Error(`Cannot access customers for segment ${segmentId}: no direct access and no searchable query`);
          }
          
          console.log(`🔍 Using customer search fallback for segment ${segmentId} with query: ${segment.query}`);
          
          // Translate segment query to customer search syntax
          const searchQuery = this.translateSegmentQueryToCustomerSearch(segment.query);
          console.log(`🔍 Translated search query: ${searchQuery}`);
          
          // Search for customers using the translated query
          const customers = await this.searchCustomers(searchQuery);
          const searchCustomerIds = customers.map(c => `gid://shopify/Customer/${c.id}`);
          
          console.log(`✅ Fallback search found ${searchCustomerIds.length} customers for segment ${segmentId}`);
          
          return searchCustomerIds.slice(0, limit); // Respect the limit
          
        } catch (fallbackError) {
          console.error(`💥 Fallback also failed for segment ${segmentId}:`, fallbackError);
          throw new Error(`Failed to fetch customers for segment ${segmentId}: Direct access failed and fallback search also failed. Original error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    console.log(`🏁 getSegmentCustomerIds completed for segment ${segmentId}. Total customers: ${customerIds.length}`);
    
    // If we got 0 customers but the segment might have customers, try fallback
    if (customerIds.length === 0) {
      console.log(`⚠️ Direct access returned 0 customers for segment ${segmentId}. Checking if fallback is needed...`);
      
      try {
        const segments = await this.getCustomerSegments();
        const segment = segments.find(s => s.id === segmentId);
        
        if (segment && segment.customer_count && segment.customer_count > 0 && segment.query) {
          console.log(`🔄 Segment ${segmentId} has ${segment.customer_count} customers but direct access returned 0. Trying search fallback...`);
          
          const searchQuery = this.translateSegmentQueryToCustomerSearch(segment.query);
          console.log(`🔍 Using fallback search query: ${searchQuery}`);
          
                     const customers = await this.searchCustomers(searchQuery);
           const searchCustomerIds = customers.map(c => `gid://shopify/Customer/${c.id}`);
           
           console.log(`✅ Fallback search found ${searchCustomerIds.length} customers for segment ${segmentId}`);
           return searchCustomerIds.slice(0, limit);
        }
      } catch (fallbackError) {
        console.error(`💥 Fallback attempt failed for segment ${segmentId}:`, fallbackError);
        // Continue with original 0 result
      }
    }
    
    return customerIds;
  }

  /**
   * Bulk add tags to all customers in a segment
   */
  async bulkAddTagsToSegment(
    segmentId: number, 
    tagsToAdd: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void,
    cancellationChecker?: () => boolean
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    if (!tagsToAdd.length) {
      throw new Error('No tags provided to add');
    }

    // Check for cancellation before starting
    if (cancellationChecker && cancellationChecker()) {
      return {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: ['Operation cancelled before starting']
      };
    }

    try {
      // Try GraphQL first, fallback to REST if it fails
      try {
        return await this.bulkAddTagsToSegmentGraphQL(segmentId, tagsToAdd, onProgress, cancellationChecker);
      } catch (graphqlError) {
        console.warn('GraphQL bulk tagging failed, trying REST API fallback:', graphqlError);
        return await this.bulkAddTagsToSegmentREST(segmentId, tagsToAdd, onProgress);
      }
    } catch (error) {
      console.error('Bulk add tags failed:', error);
      throw error;
    }
  }

  /**
   * Bulk remove tags from all customers in a segment
   */
  async bulkRemoveTagsFromSegment(
    segmentId: number, 
    tagsToRemove: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void,
    cancellationChecker?: () => boolean
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    if (!this.isInitialized()) {
      throw new Error('Shopify API service not initialized');
    }

    if (!tagsToRemove.length) {
      throw new Error('No tags provided to remove');
    }

    // Check for cancellation before starting
    if (cancellationChecker && cancellationChecker()) {
      return {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: ['Operation cancelled before starting']
      };
    }

    try {
      // Try GraphQL first, fallback to REST if it fails
      try {
        return await this.bulkRemoveTagsFromSegmentGraphQL(segmentId, tagsToRemove, onProgress, cancellationChecker);
      } catch (graphqlError) {
        console.warn('GraphQL bulk tagging failed, trying REST API fallback:', graphqlError);
        return await this.bulkRemoveTagsFromSegmentREST(segmentId, tagsToRemove, onProgress);
      }
    } catch (error) {
      console.error('Bulk remove tags failed:', error);
      throw error;
    }
  }

  /**
   * GraphQL implementation for bulk add tags
   */
  private async bulkAddTagsToSegmentGraphQL(
    segmentId: number, 
    tagsToAdd: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void,
    cancellationChecker?: () => boolean
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    // Check for cancellation before starting
    if (cancellationChecker && cancellationChecker()) {
      return {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: ['Operation cancelled before starting']
      };
    }

    // Get the official segment count first for accurate progress tracking
    onProgress?.(0, 0, 0, 'Getting official segment count...');
    let officialSegmentCount = 0;
    try {
      officialSegmentCount = await this.getSegmentCustomerCount(segmentId);
      console.log(`Official segment count: ${officialSegmentCount}`);
    } catch (error) {
      console.warn('Could not get official segment count, will use search results count:', error);
    }

    // Check for cancellation after getting count
    if (cancellationChecker && cancellationChecker()) {
      return {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: ['Operation cancelled during initialization']
      };
    }

    // Get customer IDs from the segment
    onProgress?.(0, officialSegmentCount || 0, 0, 'Fetching customer list from segment...');
    const customerIds = await this.getSegmentCustomerIds(segmentId);
    
    if (!customerIds.length) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    // Check for cancellation after getting customer IDs
    if (cancellationChecker && cancellationChecker()) {
      return {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: ['Operation cancelled after fetching customer list']
      };
    }

    // Always use actual customer count for progress tracking to avoid progress counter bugs
    const totalForProgress = customerIds.length;
    
    // Log the discrepancy if there is one
    if (officialSegmentCount > 0 && officialSegmentCount !== customerIds.length) {
      console.warn(`⚠️  Segment count discrepancy detected:`);
      console.warn(`   Official segment count: ${officialSegmentCount}`);
      console.warn(`   Actual processable customers: ${customerIds.length}`);
      console.warn(`   Using actual count (${customerIds.length}) for accurate progress tracking`);
      
      onProgress?.(0, totalForProgress, 0, `Found ${customerIds.length} processable customers (${officialSegmentCount} total in segment). Starting tag addition...`);
    } else {
      onProgress?.(0, totalForProgress, 0, `Found ${customerIds.length} customers. Starting tag addition...`);
    }

    // Use batch processing for GraphQL (more reliable than bulk operations)
    return await this.batchAddTags(
      customerIds, 
      tagsToAdd, 
      onProgress, 
      totalForProgress, 
      cancellationChecker
      // Note: Checkpoint functionality will be added when integrated with background jobs
    );
  }

  /**
   * GraphQL implementation for bulk remove tags
   */
  private async bulkRemoveTagsFromSegmentGraphQL(
    segmentId: number, 
    tagsToRemove: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void,
    cancellationChecker?: () => boolean
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    // Get the official segment count first for accurate progress tracking
    onProgress?.(0, 0, 0, 'Getting official segment count...');
    let officialSegmentCount = 0;
    try {
      officialSegmentCount = await this.getSegmentCustomerCount(segmentId);
      console.log(`Official segment count: ${officialSegmentCount}`);
    } catch (error) {
      console.warn('Could not get official segment count, will use search results count:', error);
    }

    // Get customer IDs from the segment
    onProgress?.(0, officialSegmentCount || 0, 0, 'Fetching customer list from segment...');
    const customerIds = await this.getSegmentCustomerIds(segmentId);
    
    if (!customerIds.length) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    // Always use actual customer count for progress tracking to avoid progress counter bugs
    const totalForProgress = customerIds.length;
    
    // Log the discrepancy if there is one
    if (officialSegmentCount > 0 && officialSegmentCount !== customerIds.length) {
      console.warn(`⚠️  Segment count discrepancy detected:`);
      console.warn(`   Official segment count: ${officialSegmentCount}`);
      console.warn(`   Actual processable customers: ${customerIds.length}`);
      console.warn(`   Using actual count (${customerIds.length}) for accurate progress tracking`);
      
      onProgress?.(0, totalForProgress, 0, `Found ${customerIds.length} processable customers (${officialSegmentCount} total in segment). Starting tag removal...`);
    } else {
      onProgress?.(0, totalForProgress, 0, `Found ${customerIds.length} customers. Starting tag removal...`);
    }

    // Use batch processing for GraphQL (more reliable than bulk operations)
    return await this.batchRemoveTags(customerIds, tagsToRemove, onProgress, totalForProgress, cancellationChecker);
  }

  /**
   * REST API fallback for bulk add tags
   */
  private async bulkAddTagsToSegmentREST(
    segmentId: number, 
    tagsToAdd: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    // Get customers using REST API
    const customers = await this.getSegmentCustomersREST(segmentId);
    
    if (!customers.length) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    return await this.batchAddTagsREST(customers, tagsToAdd, onProgress);
  }

  /**
   * REST API fallback for bulk remove tags
   */
  private async bulkRemoveTagsFromSegmentREST(
    segmentId: number, 
    tagsToRemove: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    // Get customers using REST API
    const customers = await this.getSegmentCustomersREST(segmentId);
    
    if (!customers.length) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    return await this.batchRemoveTagsREST(customers, tagsToRemove, onProgress);
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
  private async batchAddTagsREST(customers: ShopifyCustomer[], tagsToAdd: string[], onProgress?: (current: number, total: number, skipped: number, message: string) => void): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    const batchSize = 5; // Smaller batches for REST API
    const totalCustomers = customers.length;

    onProgress?.(0, totalCustomers, 0, `Starting to add tags to ${totalCustomers} customers via REST API...`);

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Process each customer in the batch
      await Promise.all(batch.map(async (customer, index) => {
        try {
          // Check if customer already has all the tags
          const currentTags = ShopifyAPIService.parseTags(customer.tags);
          const tagsToActuallyAdd = tagsToAdd.filter(tag => !currentTags.includes(tag));
          
          if (tagsToActuallyAdd.length === 0) {
            // All tags already exist, skip this customer
            skippedCount++;
            const currentProgress = i + index + 1;
            onProgress?.(currentProgress, totalCustomers, skippedCount, `Skipped customer ${currentProgress}/${totalCustomers} (already has tags) (REST)`);
            return;
          }

          // Add only the tags that don't already exist
          const allTags = [...currentTags, ...tagsToActuallyAdd];
          const updatedTagsString = ShopifyAPIService.formatTags(allTags);
          
          await this.updateCustomerTagsREST(customer.id, updatedTagsString);
          processedCount++;
          
          // Update progress for each customer
          const currentProgress = i + index + 1;
          onProgress?.(currentProgress, totalCustomers, skippedCount, `Tagged customer ${currentProgress}/${totalCustomers} (REST)`);
          
        } catch (error) {
          errors.push(`Failed to update customer ${customer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skippedCount++;
          onProgress?.(i + index + 1, totalCustomers, skippedCount, `Failed to tag customer ${i + index + 1}/${totalCustomers}`);
        }
      }));

      // Add delay between batches to respect rate limits
      if (i + batchSize < customers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        onProgress?.(Math.min(i + batchSize, totalCustomers), totalCustomers, skippedCount, `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalCustomers / batchSize)} (REST)`);
      }
    }

    onProgress?.(processedCount, totalCustomers, skippedCount, `Completed! Successfully tagged ${processedCount}/${totalCustomers} customers via REST API, skipped ${skippedCount}`);

    return {
      success: errors.length === 0,
      processedCount,
      skippedCount,
      errors
    };
  }

  /**
   * Batch remove tags using REST API
   */
  private async batchRemoveTagsREST(customers: ShopifyCustomer[], tagsToRemove: string[], onProgress?: (current: number, total: number, skipped: number, message: string) => void): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    const batchSize = 5;
    const totalCustomers = customers.length;

    onProgress?.(0, totalCustomers, 0, `Starting to remove tags from ${totalCustomers} customers via REST API...`);

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Process each customer in the batch
      await Promise.all(batch.map(async (customer, index) => {
        try {
          // Check if customer has any of the tags to remove
          const currentTags = ShopifyAPIService.parseTags(customer.tags);
          const tagsToActuallyRemove = tagsToRemove.filter(tag => currentTags.includes(tag));
          
          if (tagsToActuallyRemove.length === 0) {
            // None of the tags exist, skip this customer
            skippedCount++;
            const currentProgress = i + index + 1;
            onProgress?.(currentProgress, totalCustomers, skippedCount, `Skipped customer ${currentProgress}/${totalCustomers} (doesn't have tags) (REST)`);
            return;
          }

          // Remove only the tags that actually exist
          const remainingTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
          const updatedTagsString = ShopifyAPIService.formatTags(remainingTags);
          
          await this.updateCustomerTagsREST(customer.id, updatedTagsString);
          processedCount++;
          
          // Update progress for each customer
          const currentProgress = i + index + 1;
          onProgress?.(currentProgress, totalCustomers, skippedCount, `Untagged customer ${currentProgress}/${totalCustomers} (REST)`);
          
        } catch (error) {
          errors.push(`Failed to update customer ${customer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skippedCount++;
          onProgress?.(i + index + 1, totalCustomers, skippedCount, `Failed to untag customer ${i + index + 1}/${totalCustomers}`);
        }
      }));

      // Add delay between batches to respect rate limits
      if (i + batchSize < customers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        onProgress?.(Math.min(i + batchSize, totalCustomers), totalCustomers, skippedCount, `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalCustomers / batchSize)} (REST)`);
      }
    }

    onProgress?.(processedCount, totalCustomers, skippedCount, `Completed! Successfully untagged ${processedCount}/${totalCustomers} customers via REST API, skipped ${skippedCount}`);

    return {
      success: errors.length === 0,
      processedCount,
      skippedCount,
      errors
    };
  }

  /**
   * Batch process tag additions for GraphQL (smaller datasets)
   */
  private async batchAddTags(
    customerIds: string[], 
    tagsToAdd: string[], 
    onProgress?: (current: number, total: number, skipped: number, message: string) => void, 
    totalForProgress?: number,
    cancellationChecker?: () => boolean,
    checkpointSaver?: (lastProcessedId: string, processedIds: string[], batchIndex: number) => void,
    resumeFromCheckpoint?: { processedCustomerIds: string[]; batchIndex: number }
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }>   {
    const errors: string[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    const batchSize = 10; // Process in smaller batches to avoid rate limits
    const totalCustomers = totalForProgress || customerIds.length;

    // Handle checkpoint resumption
    const processedCustomerIds = resumeFromCheckpoint?.processedCustomerIds || [];
    const startBatchIndex = resumeFromCheckpoint?.batchIndex || 0;
    
    // Filter out already processed customers if resuming
    const remainingCustomerIds = resumeFromCheckpoint 
      ? customerIds.filter(id => !processedCustomerIds.includes(id))
      : customerIds;
    
    // Set initial progress based on checkpoint
    processedCount = processedCustomerIds.length;
    
    if (resumeFromCheckpoint) {
      onProgress?.(processedCount, totalCustomers, skippedCount, `Resuming from checkpoint: ${processedCount} customers already processed...`);
    } else {
      onProgress?.(0, totalCustomers, 0, `Starting to add tags to ${customerIds.length} customers...`);
    }

    for (let i = 0; i < remainingCustomerIds.length; i += batchSize) {
      const currentBatchIndex = startBatchIndex + Math.floor(i / batchSize);
      
      // Check for cancellation before processing each batch
      if (cancellationChecker && cancellationChecker()) {
        onProgress?.(processedCount, totalCustomers, skippedCount, 'Operation cancelled by user');
        return {
          success: false,
          processedCount,
          skippedCount,
          errors: [...errors, 'Operation cancelled by user']
        };
      }

      const batch = remainingCustomerIds.slice(i, i + batchSize);
      
      // Process each customer in the batch sequentially to avoid race conditions
      for (const customerId of batch) {
        try {
          // Check for cancellation before processing each customer
          if (cancellationChecker && cancellationChecker()) {
            break; // Exit the batch processing if cancelled
          }

          // First, get the customer's current tags to check if we need to add
          const customerQuery = `
            query getCustomer($id: ID!) {
              customer(id: $id) {
                id
                tags
              }
            }
          `;

          const customerResponse = await this.graphqlQuery<{
            customer: { id: string; tags: string[] };
          }>(customerQuery, { id: ShopifyAPIService.ensureCustomerGID(customerId) });

          if (customerResponse.data?.customer) {
            const currentTags = customerResponse.data.customer.tags || [];
            const tagsToActuallyAdd = tagsToAdd.filter(tag => !currentTags.includes(tag));
            
            if (tagsToActuallyAdd.length === 0) {
              // All tags already exist, skip this customer
              skippedCount++;
              onProgress?.(processedCount, totalCustomers, skippedCount, `Skipped customer (already has tags) - ${processedCount}/${totalCustomers} processed, ${skippedCount} skipped`);
              continue;
            }

            // Check for cancellation before making the update
            if (cancellationChecker && cancellationChecker()) {
              break; // Exit if cancelled
            }

            // Add only the tags that don't already exist
            const allTags = [...currentTags, ...tagsToActuallyAdd];
            
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

            const result = await this.graphqlQuery<{
              customerUpdate: {
                customer: { id: string; tags: string[] };
                userErrors: Array<{ field: string; message: string }>;
              };
            }>(mutation, {
              input: {
                id: ShopifyAPIService.ensureCustomerGID(customerId),
                tags: allTags
              }
            });

            if (result.data?.customerUpdate?.userErrors && result.data.customerUpdate.userErrors.length > 0) {
              throw new Error(result.data.customerUpdate.userErrors[0].message);
            }

            processedCount++;
            processedCustomerIds.push(customerId);
          } else {
            skippedCount++;
          }

          // Update progress for each customer
          onProgress?.(processedCount, totalCustomers, skippedCount, `Tagged customer - ${processedCount}/${totalCustomers} processed, ${skippedCount} skipped`);
          
        } catch (error) {
          errors.push(`Failed to update customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skippedCount++;
          onProgress?.(processedCount, totalCustomers, skippedCount, `Failed to tag customer - ${processedCount}/${totalCustomers} processed, ${skippedCount} skipped`);
        }
      };

      // Save checkpoint after each batch
      if (checkpointSaver && batch.length > 0) {
        const lastProcessedId = batch[batch.length - 1];
        checkpointSaver(lastProcessedId, [...processedCustomerIds], currentBatchIndex);
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < remainingCustomerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
        onProgress?.(processedCount, totalCustomers, skippedCount, `Processed batch ${currentBatchIndex + 1}/${Math.ceil(remainingCustomerIds.length / batchSize)} (checkpoint saved)`);
      }
    }

    onProgress?.(processedCount, totalCustomers, skippedCount, `Completed! Successfully tagged ${processedCount}/${totalCustomers} customers, skipped ${skippedCount}`);

    return {
      success: errors.length === 0,
      processedCount,
      skippedCount,
      errors
    };
  }

  /**
   * Batch process tag removals for GraphQL (smaller datasets)
   */
  private async batchRemoveTags(customerIds: string[], tagsToRemove: string[], onProgress?: (current: number, total: number, skipped: number, message: string) => void, totalForProgress?: number, cancellationChecker?: () => boolean): Promise<{
    success: boolean;
    processedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    const batchSize = 10;
    const totalCustomers = totalForProgress || customerIds.length;

    onProgress?.(0, totalCustomers, 0, `Starting to remove tags from ${customerIds.length} customers...`);

    for (let i = 0; i < customerIds.length; i += batchSize) {
      // Check for cancellation before processing each batch
      if (cancellationChecker && cancellationChecker()) {
        onProgress?.(processedCount, totalCustomers, skippedCount, 'Operation cancelled by user');
        return {
          success: false,
          processedCount,
          skippedCount,
          errors: [...errors, 'Operation cancelled by user']
        };
      }

      const batch = customerIds.slice(i, i + batchSize);
      
      // Process each customer in the batch sequentially to avoid race conditions
      for (const customerId of batch) {
        try {
          // Check for cancellation before processing each customer
          if (cancellationChecker && cancellationChecker()) {
            break; // Exit the batch processing if cancelled
          }

          // First, get the customer's current tags to check if we need to remove
          const customerQuery = `
            query getCustomer($id: ID!) {
              customer(id: $id) {
                id
                tags
              }
            }
          `;

          const customerResponse = await this.graphqlQuery<{
            customer: { id: string; tags: string[] };
          }>(customerQuery, { id: ShopifyAPIService.ensureCustomerGID(customerId) });

          if (customerResponse.data?.customer) {
            const currentTags = customerResponse.data.customer.tags || [];
            const tagsToActuallyRemove = tagsToRemove.filter(tag => currentTags.includes(tag));
            
            if (tagsToActuallyRemove.length === 0) {
              // None of the tags exist, skip this customer
              skippedCount++;
              onProgress?.(processedCount, totalCustomers, skippedCount, `Skipped customer (doesn't have tags) - ${processedCount}/${totalCustomers} processed, ${skippedCount} skipped`);
              continue;
            }

            // Check for cancellation before making the update
            if (cancellationChecker && cancellationChecker()) {
              break; // Exit if cancelled
            }

            // Remove only the tags that actually exist
            const remainingTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
            
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

            const result = await this.graphqlQuery<{
              customerUpdate: {
                customer: { id: string; tags: string[] };
                userErrors: Array<{ field: string; message: string }>;
              };
            }>(mutation, {
              input: {
                id: ShopifyAPIService.ensureCustomerGID(customerId),
                tags: remainingTags
              }
            });

            if (result.data?.customerUpdate?.userErrors && result.data.customerUpdate.userErrors.length > 0) {
              throw new Error(result.data.customerUpdate.userErrors[0].message);
            }

            processedCount++;
          } else {
            skippedCount++;
          }

          // Update progress for each customer
          onProgress?.(processedCount, totalCustomers, skippedCount, `Untagged customer - ${processedCount}/${totalCustomers} processed, ${skippedCount} skipped`);
          
        } catch (error) {
          errors.push(`Failed to update customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skippedCount++;
          onProgress?.(processedCount, totalCustomers, skippedCount, `Failed to untag customer - ${processedCount}/${totalCustomers} processed, ${skippedCount} skipped`);
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < customerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
        onProgress?.(processedCount, totalCustomers, skippedCount, `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(customerIds.length / batchSize)}`);
      }
    }

    onProgress?.(processedCount, totalCustomers, skippedCount, `Completed! Successfully untagged ${processedCount}/${totalCustomers} customers, skipped ${skippedCount}`);

    return {
      success: errors.length === 0,
      processedCount,
      skippedCount,
      errors
    };
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPIService();