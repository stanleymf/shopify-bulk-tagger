// Rule Execution Service
// Handles the execution of tagging rules against customer segments

import { shopifyAPI, ShopifyCustomer, ShopifyCustomerSegment } from './shopify-api';
import { TaggingRule } from '@/data/mockData';

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  segmentId: number;
  segmentName: string;
  customersProcessed: number;
  customersUpdated: number;
  customersFailed: number;
  errors: string[];
  executionTime: number;
  completedAt: string;
}

export interface RuleExecutionOptions {
  dryRun?: boolean; // If true, don't actually update customers
  batchSize?: number; // Number of customers to process in each batch
  maxRetries?: number; // Maximum number of retries for failed operations
}

class RuleExecutor {
  private isExecuting = false;
  private executionQueue: Array<{
    rule: TaggingRule;
    segment: ShopifyCustomerSegment;
    options: RuleExecutionOptions;
  }> = [];

  // Execute a single rule against a segment
  async executeRule(
    rule: TaggingRule,
    segment: ShopifyCustomerSegment,
    options: RuleExecutionOptions = {}
  ): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    const result: RuleExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      segmentId: segment.id,
      segmentName: segment.name,
      customersProcessed: 0,
      customersUpdated: 0,
      customersFailed: 0,
      errors: [],
      executionTime: 0,
      completedAt: new Date().toISOString(),
    };

    try {
      // Check if Shopify API is initialized
      if (!shopifyAPI.isInitialized()) {
        throw new Error('Shopify API not initialized. Please connect your store first.');
      }

      // Fetch customers in the segment
      const customers = await shopifyAPI.getSegmentCustomers(segment.id);
      result.customersProcessed = customers.length;

      if (customers.length === 0) {
        result.executionTime = Date.now() - startTime;
        return result;
      }

      // Process customers in batches
      const batchSize = options.batchSize || 10;
      const batches = this.chunkArray(customers, batchSize);

      for (const batch of batches) {
        const batchResults = await this.processCustomerBatch(batch, rule, options);
        
        result.customersUpdated += batchResults.updated;
        result.customersFailed += batchResults.failed;
        result.errors.push(...batchResults.errors);

        // Add delay between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

    } catch (error) {
      result.errors.push(`Rule execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  // Process a batch of customers
  private async processCustomerBatch(
    customers: ShopifyCustomer[],
    rule: TaggingRule,
    options: RuleExecutionOptions
  ): Promise<{ updated: number; failed: number; errors: string[] }> {
    const result = { updated: 0, failed: 0, errors: [] as string[] };

    if (options.dryRun) {
      // In dry run mode, just simulate the operations
      result.updated = customers.length;
      return result;
    }

    // Prepare customer updates
    const customerUpdates = customers.map(customer => {
      const currentTags = customer.tags;
      let newTags = currentTags;

      // Apply each action in the rule
      for (const action of rule.actions) {
        if (action.type === 'add') {
          newTags = this.addTags(newTags, [action.tag]);
        } else if (action.type === 'remove') {
          newTags = this.removeTags(newTags, [action.tag]);
        }
      }

      return {
        id: customer.id,
        tags: newTags,
      };
    });

    try {
      // Update customers in batch
      const updatedCustomers = await shopifyAPI.batchUpdateCustomerTags(customerUpdates);
      result.updated = updatedCustomers.length;
    } catch (error) {
      result.failed = customers.length;
      result.errors.push(`Batch update failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  // Execute multiple rules in sequence
  async executeRules(
    rules: TaggingRule[],
    segments: ShopifyCustomerSegment[],
    options: RuleExecutionOptions = {}
  ): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    for (const rule of rules) {
      if (!rule.isActive) {
        continue; // Skip inactive rules
      }

      // Find the segment for this rule
      const segment = segments.find(s => s.name === rule.triggerSegment);
      if (!segment) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          segmentId: 0,
          segmentName: rule.triggerSegment,
          customersProcessed: 0,
          customersUpdated: 0,
          customersFailed: 0,
          errors: [`Segment "${rule.triggerSegment}" not found`],
          executionTime: 0,
          completedAt: new Date().toISOString(),
        });
        continue;
      }

      const result = await this.executeRule(rule, segment, options);
      results.push(result);

      // Add delay between rules to respect rate limits
      if (rules.indexOf(rule) < rules.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  // Queue a rule for execution (for background processing)
  async queueRule(
    rule: TaggingRule,
    segment: ShopifyCustomerSegment,
    options: RuleExecutionOptions = {}
  ): Promise<void> {
    this.executionQueue.push({ rule, segment, options });
    
    if (!this.isExecuting) {
      this.processQueue();
    }
  }

  // Process the execution queue
  private async processQueue(): Promise<void> {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }

    this.isExecuting = true;

    try {
      while (this.executionQueue.length > 0) {
        const { rule, segment, options } = this.executionQueue.shift()!;
        
        try {
          await this.executeRule(rule, segment, options);
        } catch (error) {
          console.error(`Failed to execute rule ${rule.name}:`, error);
        }

        // Add delay between queued executions
        if (this.executionQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } finally {
      this.isExecuting = false;
    }
  }

  // Get execution status
  getExecutionStatus(): { isExecuting: boolean; queueLength: number } {
    return {
      isExecuting: this.isExecuting,
      queueLength: this.executionQueue.length,
    };
  }

  // Clear the execution queue
  clearQueue(): void {
    this.executionQueue = [];
  }

  // Helper method to chunk array into batches
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Helper method to parse tags string into array
  private parseTags(tagsString: string): string[] {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  // Helper method to format tags array into string
  private formatTags(tags: string[]): string {
    return tags.filter(tag => tag.length > 0).join(', ');
  }

  // Helper method to add tags to existing tags
  private addTags(existingTags: string, newTags: string[]): string {
    const existing = this.parseTags(existingTags);
    const combined = [...new Set([...existing, ...newTags])];
    return this.formatTags(combined);
  }

  // Helper method to remove tags from existing tags
  private removeTags(existingTags: string, tagsToRemove: string[]): string {
    const existing = this.parseTags(existingTags);
    const filtered = existing.filter(tag => !tagsToRemove.includes(tag));
    return this.formatTags(filtered);
  }

  // Validate a rule before execution
  validateRule(rule: TaggingRule, segments: ShopifyCustomerSegment[]): string[] {
    const errors: string[] = [];

    if (!rule.name.trim()) {
      errors.push('Rule name is required');
    }

    if (!rule.triggerSegment) {
      errors.push('Trigger segment is required');
    } else {
      const segmentExists = segments.some(s => s.name === rule.triggerSegment);
      if (!segmentExists) {
        errors.push(`Segment "${rule.triggerSegment}" not found`);
      }
    }

    if (rule.actions.length === 0) {
      errors.push('At least one action is required');
    }

    for (const action of rule.actions) {
      if (!action.tag.trim()) {
        errors.push('All actions must have a tag name');
      }
    }

    return errors;
  }
}

// Export singleton instance
export const ruleExecutor = new RuleExecutor(); 