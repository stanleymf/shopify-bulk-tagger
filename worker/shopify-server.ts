// Server-side Shopify API service for Cloudflare Workers
// Handles bulk operations directly on the server without browser dependency

export interface ShopifyServerConfig {
  shopDomain: string;
  accessToken: string;
}

export interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface ProgressCallback {
  (current: number, total: number, skipped: number, message: string): Promise<void>;
}

export class ShopifyServerAPI {
  private config: ShopifyServerConfig | null = null;
  private baseURL: string = '';
  private graphqlURL: string = '';

  constructor(config?: ShopifyServerConfig) {
    if (config) {
      this.initialize(config);
    }
  }

  initialize(config: ShopifyServerConfig): void {
    this.config = config;
    this.baseURL = `https://${config.shopDomain}/admin/api/2023-10/`;
    this.graphqlURL = `https://${config.shopDomain}/admin/api/2023-10/graphql.json`;
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  private getHeaders(): Record<string, string> {
    if (!this.config) {
      throw new Error('Shopify API not initialized');
    }

    return {
      'X-Shopify-Access-Token': this.config.accessToken,
      'Content-Type': 'application/json',
      'User-Agent': 'Bulk-Tagger-Server/1.0'
    };
  }

  private async graphqlQuery<T>(query: string, variables?: any): Promise<T> {
    if (!this.config) {
      throw new Error('Shopify API not initialized');
    }

    const response = await fetch(this.graphqlURL, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data;
  }

  private async restRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Shopify API not initialized');
    }

    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`REST request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get customer IDs from a segment
   */
  async getSegmentCustomerIds(segmentId: number, limit: number = 30000): Promise<string[]> {
    console.log(`🔍 getSegmentCustomerIds called for segment ${segmentId} with limit ${limit}`);
    
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
        const data = await this.graphqlQuery<any>(query, variables);
        console.log(`🔍 GraphQL query completed for segment ${segmentId}. Response:`, JSON.stringify(data, null, 2));
        
        if (!data.customerSegment?.customers?.edges) {
          console.warn(`⚠️ No customers found for segment ${segmentId}. Data structure:`, JSON.stringify(data, null, 2));
          break;
        }

        const edges = data.customerSegment.customers.edges;
        const batchIds = edges.map((edge: any) => edge.node.id.replace('gid://shopify/Customer/', ''));
        customerIds.push(...batchIds);

        hasNextPage = data.customerSegment.customers.pageInfo.hasNextPage;
        cursor = data.customerSegment.customers.pageInfo.endCursor;

        console.log(`✅ Fetched ${batchIds.length} customer IDs (total: ${customerIds.length}) for segment ${segmentId}`);
      } catch (error) {
        console.error(`💥 CRITICAL ERROR fetching segment customers for segment ${segmentId}:`, error);
        console.error(`💥 Error details:`, {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw error;
      }
    }

    console.log(`🏁 getSegmentCustomerIds completed for segment ${segmentId}. Total customers: ${customerIds.length}`);
    return customerIds;
  }

  /**
   * Get customer details by ID
   */
  async getCustomer(customerId: string): Promise<any> {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          tags
        }
      }
    `;

    const data = await this.graphqlQuery<any>(query, {
      id: `gid://shopify/Customer/${customerId}`
    });

    return data.customer;
  }

  /**
   * Update customer tags
   */
  async updateCustomerTags(customerId: string, tags: string[]): Promise<void> {
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

    const input = {
      id: `gid://shopify/Customer/${customerId}`,
      tags: tags
    };

    const data = await this.graphqlQuery<any>(mutation, { input });

    if (data.customerUpdate.userErrors && data.customerUpdate.userErrors.length > 0) {
      const errors = data.customerUpdate.userErrors.map((e: any) => e.message).join(', ');
      throw new Error(`Failed to update customer tags: ${errors}`);
    }
  }

  /**
   * Batch add tags to customers
   */
  async batchAddTags(
    customerIds: string[],
    tagsToAdd: string[],
    onProgress?: ProgressCallback,
    batchSize: number = 10
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      skippedCount: 0,
      errors: []
    };

    const total = customerIds.length;
    let processed = 0;

    // Process in batches
    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      
      if (onProgress) {
        await onProgress(processed, total, result.skippedCount, `Processing batch ${Math.floor(i / batchSize) + 1}...`);
      }

      // Process each customer in the batch
      for (const customerId of batch) {
        try {
          // Get current customer data
          const customer = await this.getCustomer(customerId);
          if (!customer) {
            result.skippedCount++;
            continue;
          }

          // Parse existing tags and add new ones
          const existingTags = customer.tags || [];
          const newTags = [...new Set([...existingTags, ...tagsToAdd])];

          // Only update if tags actually changed
          if (newTags.length !== existingTags.length || 
              !tagsToAdd.every(tag => existingTags.includes(tag))) {
            await this.updateCustomerTags(customerId, newTags);
          }

          result.processedCount++;
          processed++;

        } catch (error) {
          console.error(`Error processing customer ${customerId}:`, error);
          result.errors.push(`Customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.skippedCount++;
        }
      }

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (onProgress) {
      await onProgress(processed, total, result.skippedCount, 'Bulk operation completed');
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Batch remove tags from customers
   */
  async batchRemoveTags(
    customerIds: string[],
    tagsToRemove: string[],
    onProgress?: ProgressCallback,
    batchSize: number = 10
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processedCount: 0,
      skippedCount: 0,
      errors: []
    };

    const total = customerIds.length;
    let processed = 0;

    // Process in batches
    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      
      if (onProgress) {
        await onProgress(processed, total, result.skippedCount, `Processing batch ${Math.floor(i / batchSize) + 1}...`);
      }

      // Process each customer in the batch
      for (const customerId of batch) {
        try {
          // Get current customer data
          const customer = await this.getCustomer(customerId);
          if (!customer) {
            result.skippedCount++;
            continue;
          }

          // Parse existing tags and remove specified ones
          const existingTags = customer.tags || [];
          const newTags = existingTags.filter((tag: string) => !tagsToRemove.includes(tag));

          // Only update if tags actually changed
          if (newTags.length !== existingTags.length) {
            await this.updateCustomerTags(customerId, newTags);
          }

          result.processedCount++;
          processed++;

        } catch (error) {
          console.error(`Error processing customer ${customerId}:`, error);
          result.errors.push(`Customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.skippedCount++;
        }
      }

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (onProgress) {
      await onProgress(processed, total, result.skippedCount, 'Bulk operation completed');
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Execute bulk add tags operation for a segment
   */
  async bulkAddTagsToSegment(
    segmentId: number,
    segmentName: string,
    tagsToAdd: string[],
    onProgress?: ProgressCallback,
    batchSize: number = 10
  ): Promise<BulkOperationResult> {
    console.log(`🚀 bulkAddTagsToSegment called for segment ${segmentId} (${segmentName}) with tags:`, tagsToAdd);
    
    if (onProgress) {
      console.log(`📊 Calling onProgress: Fetching customer list from segment...`);
      await onProgress(0, 0, 0, 'Fetching customer list from segment...');
    }

    console.log(`🔍 About to call getSegmentCustomerIds for segment ${segmentId}...`);
    
    // Get customer IDs from segment
    const customerIds = await this.getSegmentCustomerIds(segmentId);
    
    console.log(`✅ getSegmentCustomerIds completed. Found ${customerIds.length} customers for segment ${segmentId}`);
    
    if (customerIds.length === 0) {
      console.log(`⚠️ No customers found in segment ${segmentId}. Returning early.`);
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    if (onProgress) {
      console.log(`📊 Calling onProgress: Found ${customerIds.length} customers. Starting tag addition...`);
      await onProgress(0, customerIds.length, 0, `Found ${customerIds.length} customers. Starting tag addition...`);
    }

    console.log(`🔄 About to call batchAddTags for ${customerIds.length} customers...`);
    const result = await this.batchAddTags(customerIds, tagsToAdd, onProgress, batchSize);
    console.log(`🏁 bulkAddTagsToSegment completed for segment ${segmentId}. Result:`, result);
    
    return result;
  }

  /**
   * Execute bulk remove tags operation for a segment
   */
  async bulkRemoveTagsFromSegment(
    segmentId: number,
    segmentName: string,
    tagsToRemove: string[],
    onProgress?: ProgressCallback,
    batchSize: number = 10
  ): Promise<BulkOperationResult> {
    if (onProgress) {
      await onProgress(0, 0, 0, 'Fetching customer list from segment...');
    }

    // Get customer IDs from segment
    const customerIds = await this.getSegmentCustomerIds(segmentId);
    
    if (customerIds.length === 0) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errors: ['No customers found in this segment']
      };
    }

    if (onProgress) {
      await onProgress(0, customerIds.length, 0, `Found ${customerIds.length} customers. Starting tag removal...`);
    }

    return await this.batchRemoveTags(customerIds, tagsToRemove, onProgress, batchSize);
  }
} 