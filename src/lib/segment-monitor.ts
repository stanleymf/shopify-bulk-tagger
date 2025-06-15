// Segment Monitoring Service
// Handles real-time monitoring of customer segment changes and triggers automated rules

import { shopifyAPI, ShopifyCustomerSegment, ShopifyCustomer } from './shopify-api';
import { storage } from './storage';

export interface SegmentChange {
  customerId: string;
  customerEmail: string;
  fromSegments: string[];
  toSegments: string[];
  timestamp: string;
  changeType: 'added' | 'removed' | 'moved';
}

export interface SegmentSnapshot {
  segmentId: number;
  segmentName: string;
  customerIds: string[];
  timestamp: string;
}

export interface MonitoringRule {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: 'segment_enter' | 'segment_exit' | 'segment_move';
  sourceSegment?: string; // For segment_exit and segment_move
  targetSegment: string;   // For segment_enter and segment_move
  actions: {
    type: 'add' | 'remove';
    tag: string;
  }[];
  createdAt: string;
  lastTriggered?: string;
  executionCount: number;
}

class SegmentMonitoringService {
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private segmentSnapshots: Map<number, SegmentSnapshot> = new Map();
  private monitoringRules: MonitoringRule[] = [];
  private changeHistory: SegmentChange[] = [];
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly MAX_HISTORY_SIZE = 1000;
  private initializationCheckInterval: number | null = null;

  constructor() {
    this.loadStoredData();
    this.startInitializationCheck();
  }

  // Check for Shopify API initialization and auto-start monitoring
  private startInitializationCheck(): void {
    // Check immediately if already initialized
    if (shopifyAPI.isInitialized()) {
      this.autoStartMonitoring();
      return;
    }

    // Check every 5 seconds for initialization
    this.initializationCheckInterval = setInterval(() => {
      if (shopifyAPI.isInitialized()) {
        this.autoStartMonitoring();
        if (this.initializationCheckInterval) {
          clearInterval(this.initializationCheckInterval);
          this.initializationCheckInterval = null;
        }
      }
    }, 5000);
  }

  // Automatically start monitoring when conditions are met
  private async autoStartMonitoring(): Promise<void> {
    try {
      if (!this.isMonitoring && shopifyAPI.isInitialized()) {
        console.log('🔄 Auto-starting background segment monitoring...');
        await this.startMonitoring();
        console.log('✅ Background segment monitoring is now active');
      }
    } catch (error) {
      console.error('Failed to auto-start monitoring:', error);
      // Retry after 30 seconds
      setTimeout(() => this.autoStartMonitoring(), 30000);
    }
  }

  // Load stored monitoring data
  private loadStoredData(): void {
    try {
      const appData = storage.getAppData();
      if (appData.monitoringRules) {
        this.monitoringRules = appData.monitoringRules;
      }
      if (appData.segmentSnapshots) {
        this.segmentSnapshots = new Map(appData.segmentSnapshots);
      }
      if (appData.changeHistory) {
        this.changeHistory = appData.changeHistory.slice(-this.MAX_HISTORY_SIZE);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    }
  }

  // Save monitoring data to storage
  private saveMonitoringData(): void {
    try {
      const appData = storage.getAppData();
      storage.saveAppData({
        ...appData,
        monitoringRules: this.monitoringRules,
        segmentSnapshots: Array.from(this.segmentSnapshots.entries()),
        changeHistory: this.changeHistory.slice(-this.MAX_HISTORY_SIZE),
      });
    } catch (error) {
      console.error('Failed to save monitoring data:', error);
    }
  }

  // Start monitoring segment changes
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Segment monitoring is already running');
      return;
    }

    if (!shopifyAPI.isInitialized()) {
      throw new Error('Shopify API not initialized. Please connect your store first.');
    }

    console.log('Starting segment monitoring...');
    this.isMonitoring = true;

    // Take initial snapshots
    await this.takeSegmentSnapshots();

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForSegmentChanges();
      } catch (error) {
        console.error('Error during segment monitoring:', error);
        // If API becomes uninitialized, stop monitoring and restart check
        if (!shopifyAPI.isInitialized()) {
          console.log('Shopify API no longer initialized, stopping monitoring');
          this.stopMonitoring();
          this.startInitializationCheck();
        }
      }
    }, this.MONITORING_INTERVAL);

    console.log(`Segment monitoring started with ${this.MONITORING_INTERVAL}ms interval`);
  }

  // Stop monitoring segment changes
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping segment monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.saveMonitoringData();
    console.log('Segment monitoring stopped');
  }

  // Permanently stop all monitoring (including auto-restart)
  stopAllMonitoring(): void {
    this.stopMonitoring();
    
    if (this.initializationCheckInterval) {
      clearInterval(this.initializationCheckInterval);
      this.initializationCheckInterval = null;
    }
    
    console.log('All monitoring stopped (including auto-restart)');
  }

  // Take snapshots of all segments
  private async takeSegmentSnapshots(): Promise<void> {
    try {
      const segments = await shopifyAPI.getCustomerSegments();
      console.log(`Taking snapshots of ${segments.length} segments...`);

      for (const segment of segments) {
        try {
          const customerIds = await shopifyAPI.getSegmentCustomerIds(segment.id, 30000);
          
          const snapshot: SegmentSnapshot = {
            segmentId: segment.id,
            segmentName: segment.name,
            customerIds,
            timestamp: new Date().toISOString(),
          };

          this.segmentSnapshots.set(segment.id, snapshot);
          console.log(`Snapshot taken for segment "${segment.name}": ${customerIds.length} customers`);

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to take snapshot for segment ${segment.name}:`, error);
        }
      }

      console.log('Segment snapshots completed');
    } catch (error) {
      console.error('Failed to take segment snapshots:', error);
      throw error;
    }
  }

  // Check for segment changes and trigger rules
  private async checkForSegmentChanges(): Promise<void> {
    try {
      const segments = await shopifyAPI.getCustomerSegments();
      const changes: SegmentChange[] = [];

      for (const segment of segments) {
        try {
          const currentCustomerIds = await shopifyAPI.getSegmentCustomerIds(segment.id, 30000);
          const previousSnapshot = this.segmentSnapshots.get(segment.id);

          if (!previousSnapshot) {
            // First time seeing this segment, just take a snapshot
            this.segmentSnapshots.set(segment.id, {
              segmentId: segment.id,
              segmentName: segment.name,
              customerIds: currentCustomerIds,
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          // Compare with previous snapshot
          const segmentChanges = await this.detectSegmentChanges(
            previousSnapshot,
            currentCustomerIds,
            segment.name
          );

          changes.push(...segmentChanges);

          // Update snapshot
          this.segmentSnapshots.set(segment.id, {
            segmentId: segment.id,
            segmentName: segment.name,
            customerIds: currentCustomerIds,
            timestamp: new Date().toISOString(),
          });

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to check changes for segment ${segment.name}:`, error);
        }
      }

      if (changes.length > 0) {
        console.log(`Detected ${changes.length} segment changes`);
        this.changeHistory.push(...changes);
        await this.processSegmentChanges(changes);
      }

      this.saveMonitoringData();
    } catch (error) {
      console.error('Failed to check for segment changes:', error);
    }
  }

  // Detect changes between snapshots
  private async detectSegmentChanges(
    previousSnapshot: SegmentSnapshot,
    currentCustomerIds: string[],
    segmentName: string
  ): Promise<SegmentChange[]> {
    const changes: SegmentChange[] = [];
    const previousIds = new Set(previousSnapshot.customerIds);
    const currentIds = new Set(currentCustomerIds);

    // Find customers added to segment
    const addedCustomers = currentCustomerIds.filter(id => !previousIds.has(id));
    for (const customerId of addedCustomers) {
      // For now, we'll populate email later to avoid too many API calls during monitoring
      // The email will be fetched when the change is processed or displayed
      changes.push({
        customerId,
        customerEmail: '', // Will be populated when needed
        fromSegments: [],
        toSegments: [segmentName],
        timestamp: new Date().toISOString(),
        changeType: 'added',
      });
    }

    // Find customers removed from segment
    const removedCustomers = previousSnapshot.customerIds.filter(id => !currentIds.has(id));
    for (const customerId of removedCustomers) {
      // For now, we'll populate email later to avoid too many API calls during monitoring
      changes.push({
        customerId,
        customerEmail: '', // Will be populated when needed
        fromSegments: [segmentName],
        toSegments: [],
        timestamp: new Date().toISOString(),
        changeType: 'removed',
      });
    }

    return changes;
  }

  // Get customer email by ID (lightweight version)
  private async getCustomerEmailById(customerId: string): Promise<string | null> {
    try {
      const customer = await this.getCustomerById(customerId);
      return customer?.email || null;
    } catch (error) {
      console.error(`Failed to get customer email for ${customerId}:`, error);
      return null;
    }
  }

  // Process segment changes and trigger rules
  private async processSegmentChanges(changes: SegmentChange[]): Promise<void> {
    const activeRules = this.monitoringRules.filter(rule => rule.isActive);
    
    if (activeRules.length === 0) {
      console.log('No active monitoring rules to process');
      return;
    }

    console.log(`Processing ${changes.length} changes against ${activeRules.length} active rules`);

    for (const change of changes) {
      for (const rule of activeRules) {
        if (this.shouldTriggerRule(rule, change)) {
          await this.executeMonitoringRule(rule, change);
        }
      }
    }
  }

  // Check if a rule should be triggered by a change
  private shouldTriggerRule(rule: MonitoringRule, change: SegmentChange): boolean {
    switch (rule.triggerType) {
      case 'segment_enter':
        return change.changeType === 'added' && 
               change.toSegments.includes(rule.targetSegment);
      
      case 'segment_exit':
        return change.changeType === 'removed' && 
               change.fromSegments.includes(rule.sourceSegment || '');
      
      case 'segment_move':
        return change.changeType === 'moved' &&
               change.fromSegments.includes(rule.sourceSegment || '') &&
               change.toSegments.includes(rule.targetSegment);
      
      default:
        return false;
    }
  }

  // Execute a monitoring rule for a specific change
  private async executeMonitoringRule(rule: MonitoringRule, change: SegmentChange): Promise<void> {
    try {
      console.log(`Executing rule "${rule.name}" for customer ${change.customerId}`);

      // Get customer details
      const customer = await this.getCustomerById(change.customerId);
      if (!customer) {
        console.error(`Customer ${change.customerId} not found`);
        return;
      }

      // Apply rule actions
      let currentTags = customer.tags;
      for (const action of rule.actions) {
        if (action.type === 'add') {
          // Use the static methods from the shopify-api module
          const currentTagsArray = currentTags.split(',').map(t => t.trim()).filter(t => t);
          const newTagsArray = [...new Set([...currentTagsArray, action.tag])];
          currentTags = newTagsArray.join(', ');
        } else if (action.type === 'remove') {
          const currentTagsArray = currentTags.split(',').map(t => t.trim()).filter(t => t);
          const filteredTagsArray = currentTagsArray.filter(t => t !== action.tag);
          currentTags = filteredTagsArray.join(', ');
        }
      }

      // Update customer if tags changed
      if (currentTags !== customer.tags) {
        await shopifyAPI.updateCustomerTags(customer.id, currentTags);
        console.log(`Updated tags for customer ${customer.email}: ${currentTags}`);
      }

      // Update rule execution stats
      rule.executionCount++;
      rule.lastTriggered = new Date().toISOString();

    } catch (error) {
      console.error(`Failed to execute rule "${rule.name}":`, error);
    }
  }

  // Get customer by ID
  private async getCustomerById(customerId: string): Promise<ShopifyCustomer | null> {
    try {
      const numericId = parseInt(customerId.replace('gid://shopify/Customer/', ''));
      return await shopifyAPI.getCustomer(numericId);
    } catch (error) {
      console.error(`Failed to get customer ${customerId}:`, error);
      return null;
    }
  }

  // Add a new monitoring rule
  addMonitoringRule(rule: Omit<MonitoringRule, 'id' | 'createdAt' | 'executionCount'>): string {
    const newRule: MonitoringRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      executionCount: 0,
    };

    this.monitoringRules.push(newRule);
    this.saveMonitoringData();
    
    console.log(`Added monitoring rule: ${newRule.name}`);
    return newRule.id;
  }

  // Update a monitoring rule
  updateMonitoringRule(ruleId: string, updates: Partial<MonitoringRule>): boolean {
    const ruleIndex = this.monitoringRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    this.monitoringRules[ruleIndex] = { ...this.monitoringRules[ruleIndex], ...updates };
    this.saveMonitoringData();
    
    console.log(`Updated monitoring rule: ${ruleId}`);
    return true;
  }

  // Delete a monitoring rule
  deleteMonitoringRule(ruleId: string): boolean {
    const initialLength = this.monitoringRules.length;
    this.monitoringRules = this.monitoringRules.filter(rule => rule.id !== ruleId);
    
    if (this.monitoringRules.length < initialLength) {
      this.saveMonitoringData();
      console.log(`Deleted monitoring rule: ${ruleId}`);
      return true;
    }
    
    return false;
  }

  // Get all monitoring rules
  getMonitoringRules(): MonitoringRule[] {
    return [...this.monitoringRules];
  }

  // Get change history
  getChangeHistory(limit: number = 100): SegmentChange[] {
    return this.changeHistory.slice(-limit).reverse();
  }

  // Get change history with customer emails populated
  async getChangeHistoryWithEmails(limit: number = 100): Promise<SegmentChange[]> {
    const changes = this.getChangeHistory(limit);
    const enrichedChanges: SegmentChange[] = [];

    for (const change of changes) {
      if (!change.customerEmail) {
        // Try to get customer email if not already populated
        const customerEmail = await this.getCustomerEmailById(change.customerId);
        enrichedChanges.push({
          ...change,
          customerEmail: customerEmail || 'Unknown'
        });
      } else {
        enrichedChanges.push(change);
      }
    }

    return enrichedChanges;
  }

  // Get monitoring status
  getMonitoringStatus(): {
    isMonitoring: boolean;
    activeRules: number;
    totalRules: number;
    lastCheck?: string;
    segmentCount: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      activeRules: this.monitoringRules.filter(rule => rule.isActive).length,
      totalRules: this.monitoringRules.length,
      lastCheck: this.segmentSnapshots.size > 0 ? 
        Math.max(...Array.from(this.segmentSnapshots.values()).map(s => new Date(s.timestamp).getTime())).toString() : 
        undefined,
      segmentCount: this.segmentSnapshots.size,
    };
  }

  // Force a manual check for changes
  async forceCheck(): Promise<SegmentChange[]> {
    if (!shopifyAPI.isInitialized()) {
      throw new Error('Shopify API not initialized');
    }

    console.log('Forcing manual segment change check...');
    await this.checkForSegmentChanges();
    return this.getChangeHistory(50);
  }

  // Clear all monitoring data
  clearMonitoringData(): void {
    this.segmentSnapshots.clear();
    this.changeHistory = [];
    this.monitoringRules = [];
    this.saveMonitoringData();
    console.log('Cleared all monitoring data');
  }
}

// Export singleton instance
export const segmentMonitor = new SegmentMonitoringService(); 