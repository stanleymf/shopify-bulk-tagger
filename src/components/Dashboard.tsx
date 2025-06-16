import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  RefreshCw, 
  Plus, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  Hash,
  Tag,
  TagIcon
} from "lucide-react";
import { shopifyAPI, ShopifyCustomerSegment } from "@/lib/shopify-api";
import { useConfig } from "@/lib/config-context";
import { backgroundJobsService, BackgroundJob } from '../lib/background-jobs';
import { serverJobsService, ServerJob } from '../lib/server-jobs';

export function Dashboard() {
  const { isConnected } = useConfig();
  const [segments, setSegments] = useState<ShopifyCustomerSegment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Bulk tagging state
  const [bulkTaggingState, setBulkTaggingState] = useState<{
    isActive: boolean;
    segmentId: number | null;
    operation: 'add' | 'remove' | null;
    progress: { current: number; total: number; skipped: number; message: string };
  }>({
    isActive: false,
    segmentId: null,
    operation: null,
    progress: { current: 0, total: 0, skipped: 0, message: '' }
  });
  const [bulkTagsInput, setBulkTagsInput] = useState("");

  // Background jobs state
  const [activeJob, setActiveJob] = useState<BackgroundJob | null>(null);
  const [jobHistory, setJobHistory] = useState<BackgroundJob[]>([]);

  // Server jobs state
  const [serverJobs, setServerJobs] = useState<ServerJob[]>([]);
  const [serverProcessingAvailable, setServerProcessingAvailable] = useState(false);

  // Load segments on component mount
  useEffect(() => {
    console.log('🎯 Dashboard useEffect called - initializing background jobs');
    loadSegments();
    
    // Load background jobs
    console.log('📋 Loading background jobs from service...');
    const currentActiveJob = backgroundJobsService.getActiveJob();
    const allJobs = backgroundJobsService.getAllJobs();
    console.log('📊 Found active job:', currentActiveJob?.id || 'none');
    console.log('📈 Total jobs in history:', allJobs.length);
    
    setActiveJob(currentActiveJob);
    setJobHistory(allJobs);

    // Load server jobs
    loadServerJobs();
    
    // Subscribe to active job updates if there is one
    if (currentActiveJob) {
      backgroundJobsService.subscribeToJob(currentActiveJob.id, (job) => {
        setActiveJob(job);
        setJobHistory(backgroundJobsService.getAllJobs());
        
        // Update the bulk tagging state for UI compatibility
        setBulkTaggingState(prev => ({
          ...prev,
          isActive: job.status === 'running',
          progress: job.progress
        }));
      });
      
      // Check if the job needs to be resumed (was interrupted by page reload)
      if (backgroundJobsService.needsResumption(currentActiveJob.id)) {
        setSuccess(`Resuming background job: ${currentActiveJob.type === 'bulk_add_tags' ? 'Adding' : 'Removing'} tags for "${currentActiveJob.segmentName}"`);
        
        // Resume the job automatically
        backgroundJobsService.resumeJob(currentActiveJob.id, shopifyAPI)
          .then(() => {
            console.log('Job resumed successfully');
            setSuccess(`Background job resumed successfully!`);
          })
          .catch((error) => {
            console.error('Failed to resume job:', error);
            setError(`Failed to resume background job: ${error.message}`);
          });
      }
    }
  }, []);

  // Filter segments based on search term
  const filteredSegments = segments.filter(segment => 
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (segment.query && segment.query.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const loadSegments = () => {
    try {
      // Load segments from storage first
      const storedSegments = shopifyAPI.getStoredSegmentsSync();
      setSegments(storedSegments);
    } catch (error) {
      console.error('Failed to load segments:', error);
    }
  };

  const loadServerJobs = async () => {
    try {
      const available = await serverJobsService.isServerProcessingAvailable();
      setServerProcessingAvailable(available);
      
      if (available) {
        const jobs = await serverJobsService.getAllJobs();
        setServerJobs(jobs);
      }
    } catch (error) {
      console.error('Failed to load server jobs:', error);
      setServerProcessingAvailable(false);
    }
  };

  // Auto-refresh server jobs every 5 seconds if there are active jobs
  useEffect(() => {
    if (!serverProcessingAvailable) return;

    const hasActiveJobs = serverJobs.some(job => job.status === 'queued' || job.status === 'running');
    
    if (hasActiveJobs) {
      const interval = setInterval(() => {
        loadServerJobs();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [serverProcessingAvailable, serverJobs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      if (!shopifyAPI.isInitialized()) {
        throw new Error('Please connect your Shopify store in Settings first');
      }

      // Fetch fresh segments from Shopify
      const freshSegments = await shopifyAPI.getCustomerSegments();
      setSegments(freshSegments);
      
      setSuccess(`Successfully synced ${freshSegments.length} customer segments!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync segments';
      setError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadCustomerCount = async (segmentId: number) => {
    try {
      // Set loading state
      await shopifyAPI.setSegmentCountLoading(segmentId, true);
      loadSegments(); // Refresh UI to show loading state

      // Fetch customer count
      const count = await shopifyAPI.getSegmentCustomerCount(segmentId);
      
      // Update segment with count
      await shopifyAPI.updateSegmentCustomerCount(segmentId, count);
      loadSegments(); // Refresh UI to show count
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load customer count';
      setError(errorMessage);
      
      // Clear loading state on error
      await shopifyAPI.setSegmentCountLoading(segmentId, false);
      loadSegments();
    }
  };

  const handleConnectStore = () => {
    // Navigate to settings page
    window.location.hash = '#settings';
  };

  const handleClearCounts = () => {
    // Clear all customer counts for debugging
    const clearedSegments = segments.map(segment => ({
      ...segment,
      customer_count: undefined,
      is_loading_count: false
    }));
    
    // Update localStorage
    localStorage.setItem('shopify_segments', JSON.stringify(clearedSegments));
    setSegments(clearedSegments);
    setSuccess('Cleared all customer counts - Load Count buttons should now be visible');
  };

  const handleTestCustomerAccess = async (segmentId: number) => {
    setError(null);
    setSuccess(null);
    
    try {
      if (!shopifyAPI.isInitialized()) {
        throw new Error('Please connect your Shopify store in Settings first');
      }

      const segment = segments.find(s => s.id === segmentId);
      const segmentName = segment?.name || 'Unknown Segment';
      
      setSuccess(`Testing customer access for "${segmentName}"... Check browser console for detailed logs.`);
      
      // This will trigger the detailed logging we added
      const customerIds = await shopifyAPI.getSegmentCustomerIds(segmentId, 10);
      
      if (customerIds.length > 0) {
        setSuccess(`✅ Successfully accessed ${customerIds.length} customers in "${segmentName}". Bulk tagging should work.`);
      } else {
        setError(`❌ Could not access customers in "${segmentName}". Check console for details. This segment may not support bulk operations.`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test customer access';
      setError(`❌ Customer access test failed: ${errorMessage}`);
    }
  };

  // Bulk tagging handlers
  const handleStartBulkTagging = (segmentId: number, mode: 'add' | 'remove') => {
    setBulkTaggingState({
      isActive: false,
      segmentId,
      operation: mode,
      progress: { current: 0, total: 0, skipped: 0, message: '' }
    });
    setBulkTagsInput("");
    setError(null);
    setSuccess(null);
  };

  const handleCancelBulkTagging = () => {
    setBulkTaggingState({
      isActive: false,
      segmentId: null,
      operation: null,
      progress: { current: 0, total: 0, skipped: 0, message: '' }
    });
    setBulkTagsInput('');
    setError(null);
    setSuccess(null);
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Resume the job
      await backgroundJobsService.resumePausedJob(jobId, shopifyAPI);
      
      // Update UI state
      const resumedJob = backgroundJobsService.getJob(jobId);
      if (resumedJob) {
        setActiveJob(resumedJob);
        
        // Subscribe to job updates
        backgroundJobsService.subscribeToJob(jobId, (updatedJob) => {
          setActiveJob(updatedJob);
          setJobHistory(backgroundJobsService.getAllJobs());
          
          // If job completed, clear active job
          if (updatedJob.status !== 'running') {
            setActiveJob(null);
            if (updatedJob.status === 'completed') {
              setSuccess(`Job completed successfully! Processed ${updatedJob.result?.processedCount || 0} customers.`);
            } else if (updatedJob.status === 'failed') {
              setError(`Job failed: ${updatedJob.result?.errors.join(', ') || 'Unknown error'}`);
            } else if (updatedJob.status === 'cancelled') {
              setSuccess('Job was cancelled successfully.');
            }
          }
        });
        
        setSuccess('Job resumed successfully!');
      }
    } catch (error) {
      console.error('Failed to resume job:', error);
      setError(error instanceof Error ? error.message : 'Failed to resume job');
    }
  };

  const handleQueueServerJob = async (segmentId: number, operation: 'add' | 'remove') => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    const tags = bulkTagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tags.length === 0) {
      setError('Please enter at least one tag');
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const result = await serverJobsService.queueBulkTagJob(
        operation === 'add' ? 'bulk_add_tags' : 'bulk_remove_tags',
        segmentId,
        segment.name,
        tags
      );

      setSuccess(`✅ Server job queued successfully! Job ID: ${result.jobId}`);
      setBulkTagsInput('');
      setBulkTaggingState({
        isActive: false,
        segmentId: null,
        operation: null,
        progress: { current: 0, total: 0, skipped: 0, message: '' }
      });

      // Refresh server jobs
      await loadServerJobs();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to queue server job';
      setError(`❌ Failed to queue server job: ${errorMessage}`);
    }
  };

  const handleTriggerJobProcessing = async () => {
    try {
      setError(null);
      const result = await serverJobsService.triggerJobProcessing();
      setSuccess(`✅ ${result.message}. Active jobs: ${result.stats.activeJobs}/${result.stats.maxConcurrentJobs}`);
      
      // Refresh server jobs after a short delay
      setTimeout(() => {
        loadServerJobs();
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger job processing';
      setError(`❌ ${errorMessage}`);
    }
  };

  const handleExecuteBulkTagging = async () => {
    if (!bulkTaggingState.segmentId || !bulkTaggingState.operation || !bulkTagsInput.trim()) {
      setError('Please enter tags to process');
      return;
    }

    if (!shopifyAPI.isInitialized()) {
      setError('Please connect your Shopify store in Settings first');
      return;
    }

    // Parse tags from input (comma-separated)
    const tags = bulkTagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    if (tags.length === 0) {
      setError('Please enter valid tags');
      return;
    }

    // Get segment info
    const segment = segments.find(s => s.id === bulkTaggingState.segmentId);
    if (!segment) {
      setError('Segment not found');
      return;
    }

    // Start background job with enhanced settings for large operations
    const segmentCustomerCount = segment.customer_count || 0;
    const isLargeOperation = segmentCustomerCount > 1000;
    
    const jobId = backgroundJobsService.startJob(
      bulkTaggingState.operation === 'add' ? 'bulk_add_tags' : 'bulk_remove_tags',
      bulkTaggingState.segmentId,
      segment.name,
      tags,
      {
        batchSize: isLargeOperation ? 5 : 10, // Smaller batches for large operations
        saveInterval: isLargeOperation ? 25 : 50, // More frequent checkpoints for large operations
        maxRetries: 3,
        timeoutMinutes: isLargeOperation ? 60 : 30 // Longer timeout for large operations
      }
    );

    // Update local state
    const newJob = backgroundJobsService.getJob(jobId);
    if (newJob) {
      setActiveJob(newJob);
      setJobHistory(backgroundJobsService.getAllJobs());
    }

    // Subscribe to job updates
    backgroundJobsService.subscribeToJob(jobId, (job) => {
      setActiveJob(job);
      setJobHistory(backgroundJobsService.getAllJobs());
      
      // Update the old bulk tagging state for UI compatibility
      setBulkTaggingState(prev => ({
        ...prev,
        isActive: job.status === 'running',
        progress: job.progress
      }));
      
      // Show completion message
      if (job.status === 'completed' && job.result) {
        const action = job.type === 'bulk_add_tags' ? 'added to' : 'removed from';
        setSuccess(
          `Successfully ${action} ${job.result.processedCount} customers in "${job.segmentName}" with tags: ${job.tags.join(', ')}${job.result.skippedCount > 0 ? ` (Skipped: ${job.result.skippedCount})` : ''}`
        );
        handleCancelBulkTagging();
      } else if (job.status === 'failed' && job.result) {
        setError(`Bulk tagging failed: ${job.result.errors.join(', ')}`);
      }
    });

    setBulkTaggingState(prev => ({
      ...prev,
      isActive: true,
      progress: { current: 0, total: 0, skipped: 0, message: 'Initializing...' }
    }));

    setError(null);
    setSuccess(null);

    try {
      let result;
      if (bulkTaggingState.operation === 'add') {
        result = await shopifyAPI.bulkAddTagsToSegment(
          bulkTaggingState.segmentId, 
          tags,
          (current: number, total: number, skipped: number, message: string) => {
            // Update background job progress
            backgroundJobsService.updateJobProgress(jobId, current, total, skipped, message);
          },
          () => backgroundJobsService.isJobCancelled(jobId) // Cancellation checker
        );
      } else {
        result = await shopifyAPI.bulkRemoveTagsFromSegment(
          bulkTaggingState.segmentId, 
          tags,
          (current: number, total: number, skipped: number, message: string) => {
            // Update background job progress
            backgroundJobsService.updateJobProgress(jobId, current, total, skipped, message);
          },
          () => backgroundJobsService.isJobCancelled(jobId) // Cancellation checker
        );
      }

      // Complete the background job
      backgroundJobsService.completeJob(jobId, result);

      if (result.success) {
        const segmentName = segment?.name || 'Unknown Segment';
        const action = bulkTaggingState.operation === 'add' ? 'added to' : 'removed from';
        
        setSuccess(
          `Successfully ${action} ${result.processedCount} customers in "${segmentName}" with tags: ${tags.join(', ')}${result.skippedCount > 0 ? ` (Skipped: ${result.skippedCount})` : ''}`
        );
        handleCancelBulkTagging();
      } else {
        // Check if it's a customer access issue
        const hasCustomerAccessError = result.errors.some(error => 
          error.includes('No customers found') || 
          error.includes('permissions') ||
          error.includes('could not retrieve them')
        );
        
        if (hasCustomerAccessError && result.processedCount === 0) {
          setError(
            `Unable to access customers in this segment. This might be due to: 
            1) Segment permissions - some segments don't allow direct customer access
            2) Dynamic segments - computed segments may not support bulk operations
            3) API limitations - try using individual customer tagging instead
            
            Error details: ${result.errors.join(', ')}`
          );
        } else {
          setError(`Bulk tagging completed with errors: ${result.errors.join(', ')}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process bulk tagging';
      
      // Complete the background job with error
      backgroundJobsService.completeJob(jobId, {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errors: [errorMessage]
      });
      
      setError(errorMessage);
    } finally {
      setBulkTaggingState(prev => ({
        ...prev,
        isActive: false
      }));
      
      // Unsubscribe from job updates
      backgroundJobsService.unsubscribeFromJob(jobId);
    }
  };

  const handleTestBulkJobsSystem = () => {
    console.log('🧪 Testing Background Jobs System...');
    console.log('🔍 backgroundJobsService:', backgroundJobsService);
    console.log('🔍 backgroundJobsService methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(backgroundJobsService)));
    
    // Create a test job
    const jobId = backgroundJobsService.startJob(
      'bulk_add_tags',
      999,
      'Test Segment',
      ['test-tag'],
      {
        batchSize: 5,
        saveInterval: 10,
        maxRetries: 3,
        timeoutMinutes: 15
      }
    );
    
    console.log('✅ Test job created with ID:', jobId);
    
    // Subscribe to job updates
    backgroundJobsService.subscribeToJob(jobId, (job) => {
      console.log('📊 Job update:', job);
      setActiveJob(job);
      setJobHistory(backgroundJobsService.getAllJobs());
    });
    
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      backgroundJobsService.updateJobProgress(jobId, progress, 100, 2, `Processing customer ${progress}/100...`);
      
      if (progress >= 100) {
        clearInterval(interval);
        backgroundJobsService.completeJob(jobId, {
          success: true,
          processedCount: 98,
          skippedCount: 2,
          errors: []
        });
        console.log('✅ Test job completed successfully!');
        setSuccess('Test background job completed successfully! The system is working.');
      }
    }, 1000);
    
    // Update UI
    const newJob = backgroundJobsService.getJob(jobId);
    if (newJob) {
      setActiveJob(newJob);
      setJobHistory(backgroundJobsService.getAllJobs());
    }
    
    setSuccess('Test job started! Watch the background jobs section for progress...');
  };

  const handleDebugShopifyAPI = async () => {
    console.log('🔍 Debugging Shopify API...');
    
    try {
      console.log('API Initialized:', shopifyAPI.isInitialized());
      
      if (!shopifyAPI.isInitialized()) {
        setError('Shopify API is not initialized. Please check your settings.');
        return;
      }
      
      // Test connection
      console.log('Testing connection...');
      const connectionResult = await shopifyAPI.testConnection();
      console.log('Connection test result:', connectionResult);
      
      // Get segments
      console.log('Getting segments...');
      const segments = await shopifyAPI.getCustomerSegments();
      console.log('Segments:', segments);
      
      if (segments.length > 0) {
        const firstSegment = segments[0];
        console.log('Testing with first segment:', firstSegment);
        
        // Try to get customer IDs
        try {
          console.log('Getting customer IDs...');
          const customerIds = await shopifyAPI.getSegmentCustomerIds(firstSegment.id, 10); // Limit to 10 for testing
          console.log('Customer IDs:', customerIds);
          
          setSuccess(`✅ Shopify API debug complete! Found ${segments.length} segments, first segment has ${customerIds.length} customers.`);
        } catch (error) {
          console.error('Failed to get customer IDs:', error);
          setError(`Failed to get customer IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        setError('No segments found. Please sync your segments first.');
      }
      
    } catch (error) {
      console.error('Shopify API debug failed:', error);
      setError(`Shopify API debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const totalCustomers = segments.reduce((sum, segment) => sum + (segment.customer_count || 0), 0);
  const lastSync = shopifyAPI.getLastSyncSync();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customer Segments</h1>
          <p className="text-gray-600 mt-1">Manage your Shopify customer segments and their tags</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleTestBulkJobsSystem} 
            variant="outline"
            className="border-green-300 hover:bg-green-50 text-xs text-green-700"
          >
            🧪 Test Jobs System
          </Button>
          <Button 
            onClick={handleDebugShopifyAPI} 
            variant="outline"
            className="border-purple-300 hover:bg-purple-50 text-xs text-purple-700"
          >
            🔍 Debug API
          </Button>
          <Button 
            onClick={handleClearCounts} 
            variant="outline"
            className="border-gray-300 hover:bg-gray-50 text-xs"
          >
            Clear Counts (Debug)
          </Button>
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing || !isConnected}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Segments
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {segments.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search segments by name or query..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full"
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Background Jobs Status */}
      {(activeJob || jobHistory.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
              Background Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeJob && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium text-blue-900">
                      {activeJob.type === 'bulk_add_tags' ? 'Adding Tags' : 'Removing Tags'}
                    </span>
                    <span className="text-sm text-blue-700">
                      to "{activeJob.segmentName}"
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Are you sure you want to pause this operation? You can resume it later.')) {
                          backgroundJobsService.pauseJob(activeJob.id);
                          setActiveJob(null);
                          setJobHistory(backgroundJobsService.getAllJobs());
                          setSuccess('Bulk tagging operation paused successfully');
                        }
                      }}
                      className="text-xs px-3 py-1 bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                    >
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Are you sure you want to stop this operation? This cannot be undone.')) {
                          backgroundJobsService.cancelJob(activeJob.id);
                          setActiveJob(null);
                          setJobHistory(backgroundJobsService.getAllJobs());
                          setSuccess('Bulk tagging operation stopped successfully');
                        }
                      }}
                      className="text-xs px-3 py-1"
                    >
                      Stop Operation
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        backgroundJobsService.forceStopJob(activeJob.id);
                        setActiveJob(null);
                        setJobHistory(backgroundJobsService.getAllJobs());
                        setSuccess('Background job terminated');
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      title="Force stop (immediate)"
                    >
                      ×
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    Progress: {activeJob.progress.current}/{activeJob.progress.total}
                    {activeJob.progress.skipped > 0 && (
                      <span className="text-orange-600 ml-2">
                        (Skipped: {activeJob.progress.skipped})
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-blue-700">
                    {activeJob.progress.total > 0 ? Math.round((activeJob.progress.current / activeJob.progress.total) * 100) : 0}%
                  </span>
                </div>
                
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ 
                      width: activeJob.progress.total > 0 ? `${(activeJob.progress.current / activeJob.progress.total) * 100}%` : '0%' 
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-800">{activeJob.progress.message}</p>
                  <span className="text-xs text-blue-600">
                    Running for {backgroundJobsService.getJobDuration(activeJob)}
                  </span>
                </div>
                
                {/* Enhanced job statistics */}
                {(() => {
                  const stats = backgroundJobsService.getJobStats(activeJob.id);
                  return stats && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-blue-100 rounded px-2 py-1">
                        <span className="text-blue-600">Rate: </span>
                        <span className="font-medium text-blue-800">{stats.rate} customers/min</span>
                      </div>
                      <div className="bg-blue-100 rounded px-2 py-1">
                        <span className="text-blue-600">ETA: </span>
                        <span className="font-medium text-blue-800">{stats.eta}</span>
                      </div>
                      {activeJob.checkpoint && (
                        <>
                          <div className="bg-green-100 rounded px-2 py-1">
                            <span className="text-green-600">💾 Checkpoint: </span>
                            <span className="font-medium text-green-800">{stats.checkpointAge}</span>
                          </div>
                          <div className="bg-green-100 rounded px-2 py-1">
                            <span className="text-green-600">Batch: </span>
                            <span className="font-medium text-green-800">{activeJob.checkpoint.batchIndex + 1}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                
                <div className="mt-2 text-xs text-blue-600">
                  Tags: {activeJob.tags.join(', ')}
                  {activeJob.settings && (
                    <span className="ml-2 text-blue-500">
                      (Batch size: {activeJob.settings.batchSize}, Save every: {activeJob.settings.saveInterval})
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {jobHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Recent Jobs</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      backgroundJobsService.clearCompletedJobs();
                      setJobHistory(backgroundJobsService.getAllJobs());
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear History
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {jobHistory.slice(0, 5).map((job) => (
                    <div key={job.id} className="bg-gray-50 rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            job.status === 'completed' ? 'bg-green-500' :
                            job.status === 'failed' ? 'bg-red-500' :
                            job.status === 'paused' ? 'bg-yellow-500' :
                            job.status === 'cancelled' ? 'bg-gray-500' :
                            'bg-blue-500'
                          }`}></div>
                          <span className="font-medium">
                            {job.type === 'bulk_add_tags' ? 'Added' : 'Removed'} tags
                          </span>
                          <span className="text-gray-600">
                            {job.status === 'running' ? 'Running' : 
                             job.status === 'completed' ? 'Completed' :
                             job.status === 'failed' ? 'Failed' : 
                             job.status === 'cancelled' ? 'Cancelled' : 'Paused'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {backgroundJobsService.getJobDuration(job)}
                          </span>
                          {job.status === 'paused' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResumeJob(job.id)}
                              className="text-xs px-2 py-1 h-6 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            >
                              Resume
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-1">
                        Segment: {job.segmentName} | Tags: {job.tags.join(', ')}
                      </div>
                      
                      {job.result && (
                        <div className="text-xs text-gray-600">
                          Processed: {job.result.processedCount}
                          {job.result.skippedCount > 0 && ` | Skipped: ${job.result.skippedCount}`}
                          {job.result.errors.length > 0 && ` | Errors: ${job.result.errors.length}`}
                        </div>
                      )}
                      
                      {job.status === 'paused' && (
                        <div className="text-xs text-yellow-600 mt-1 font-medium">
                          ⏸️ Operation paused - Progress: {job.progress.current}/{job.progress.total}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Segments</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{segments.length}</div>
            {searchTerm && (
              <div className="text-sm text-gray-500 mt-1">
                {filteredSegments.length} filtered
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalCustomers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Last Sync</CardTitle>
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {lastSync ? new Date(lastSync).toLocaleTimeString() : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-gray-900">Segments Overview</CardTitle>
            {searchTerm && filteredSegments.length !== segments.length && (
              <div className="text-sm text-gray-500">
                Showing {filteredSegments.length} of {segments.length} segments
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Store not connected</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Connect your Shopify store to sync customer segments and start managing your customer tags.
              </p>
              <Button onClick={handleConnectStore} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Connect Shopify Store
              </Button>
            </div>
          ) : segments.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No segments found</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Your store is connected but no customer segments were found. Click "Sync Segments" to fetch the latest data.
              </p>
              <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Sync Segments
              </Button>
            </div>
          ) : filteredSegments.length === 0 ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No segments match your search</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Try adjusting your search terms or clear the search to see all segments.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSearchTerm("")}
                className="border-gray-300 hover:bg-gray-50"
              >
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredSegments.map((segment) => (
                  <Card
                    key={segment.id}
                    className="hover:shadow-lg transition-all duration-200 border-gray-200 hover:border-gray-300"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
                            {segment.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>ID: {segment.id}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {segment.customer_count !== undefined ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Users className="h-3 w-3 mr-1" />
                              {segment.customer_count.toLocaleString()}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLoadCustomerCount(segment.id)}
                              disabled={segment.is_loading_count}
                              className="text-xs h-8 px-3 border-gray-300 hover:bg-gray-50"
                            >
                              {segment.is_loading_count ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Hash className="h-3 w-3 mr-1" />
                                  Load Count
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {segment.query && (
                          <div className="bg-gray-50 rounded-md p-3">
                            <div className="text-xs font-medium text-gray-700 mb-1">Query</div>
                            <div className="text-sm text-gray-600 break-words">
                              {segment.query}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white border border-gray-100 rounded-md p-2">
                            <div className="font-medium text-gray-700 mb-1">Created</div>
                            <div className="text-gray-600">
                              {new Date(segment.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-md p-2">
                            <div className="font-medium text-gray-700 mb-1">Updated</div>
                            <div className="text-gray-600">
                              {new Date(segment.updated_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>
                        
                        {/* Bulk Tagging Section */}
                        {bulkTaggingState.segmentId === segment.id ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-blue-900">
                                {bulkTaggingState.operation === 'add' ? 'Add Tags' : 'Remove Tags'}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelBulkTagging}
                                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </Button>
                            </div>
                            <Input
                              placeholder="Enter tags separated by commas (e.g., vip, newsletter, sale)"
                              value={bulkTagsInput}
                              onChange={(e) => setBulkTagsInput(e.target.value)}
                              className="text-sm"
                              disabled={bulkTaggingState.isActive}
                            />
                            
                            {/* Progress Display */}
                            {bulkTaggingState.isActive && (
                              <div className="bg-white border border-blue-300 rounded-md p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-blue-900">
                                    Progress: {bulkTaggingState.progress.current}/{bulkTaggingState.progress.total}
                                    {bulkTaggingState.progress.skipped > 0 && (
                                      <span className="text-orange-600 ml-2">
                                        (Skipped: {bulkTaggingState.progress.skipped})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-blue-700">
                                    {bulkTaggingState.progress.total > 0 
                                      ? `${Math.round((bulkTaggingState.progress.current / bulkTaggingState.progress.total) * 100)}%`
                                      : '0%'
                                    }
                                  </span>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="w-full bg-blue-100 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                    style={{ 
                                      width: bulkTaggingState.progress.total > 0 
                                        ? `${(bulkTaggingState.progress.current / bulkTaggingState.progress.total) * 100}%`
                                        : '0%'
                                    }}
                                  />
                                </div>
                                
                                {/* Status Message */}
                                <div className="text-xs text-blue-700">
                                  {bulkTaggingState.progress.message}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              {/* Client-Side Execution */}
                              <Button
                                size="sm"
                                onClick={handleExecuteBulkTagging}
                                disabled={bulkTaggingState.isActive || !bulkTagsInput.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-xs"
                              >
                                {bulkTaggingState.isActive ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <Tag className="h-3 w-3 mr-1" />
                                    Run Now (Browser)
                                  </>
                                )}
                              </Button>
                              
                              {/* Server-Side Execution */}
                              {serverProcessingAvailable && (
                                <Button
                                  size="sm"
                                  onClick={() => handleQueueServerJob(segment.id, bulkTaggingState.operation!)}
                                  disabled={bulkTaggingState.isActive || !bulkTagsInput.trim()}
                                  className="bg-purple-600 hover:bg-purple-700 text-xs"
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  Queue for Server
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelBulkTagging}
                                disabled={bulkTaggingState.isActive}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Client-Side Bulk Tagging */}
                            <div className="text-xs font-medium text-gray-600 mb-1">Browser-Based (Requires Active Session)</div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartBulkTagging(segment.id, 'add')}
                                className="flex-1 text-xs h-8 border-green-300 text-green-700 hover:bg-green-50"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Tags
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartBulkTagging(segment.id, 'remove')}
                                className="flex-1 text-xs h-8 border-red-300 text-red-700 hover:bg-red-50"
                              >
                                <TagIcon className="h-3 w-3 mr-1" />
                                Remove Tags
                              </Button>
                            </div>

                            {/* Server-Side Job Queue */}
                            {serverProcessingAvailable && (
                              <>
                                <div className="text-xs font-medium text-purple-600 mb-1 flex items-center">
                                  ☁️ Server-Side (Runs Even When Browser Closed)
                                </div>
                                                                 <div className="flex gap-2">
                                   <Button
                                     size="sm"
                                     onClick={() => {
                                       setBulkTaggingState({
                                         isActive: false,
                                         segmentId: segment.id,
                                         operation: 'add',
                                         progress: { current: 0, total: 0, skipped: 0, message: 'Preparing server job...' }
                                       });
                                     }}
                                     className="flex-1 text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white"
                                   >
                                     <Plus className="h-3 w-3 mr-1" />
                                     Queue Add Tags
                                   </Button>
                                   <Button
                                     size="sm"
                                     onClick={() => {
                                       setBulkTaggingState({
                                         isActive: false,
                                         segmentId: segment.id,
                                         operation: 'remove',
                                         progress: { current: 0, total: 0, skipped: 0, message: 'Preparing server job...' }
                                       });
                                     }}
                                     className="flex-1 text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white"
                                   >
                                     <TagIcon className="h-3 w-3 mr-1" />
                                     Queue Remove Tags
                                   </Button>
                                 </div>
                              </>
                            )}
                          </div>
                        )}
                        
                                          {/* Debug Info */}
                        <div className="space-y-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTestCustomerAccess(segment.id)}
                            className="w-full text-xs h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          >
                            🔍 Test Customer Access (Debug)
                          </Button>
                          <div className="text-xs text-gray-400 text-center">
                            Server Processing: {serverProcessingAvailable ? '✅ Available' : '❌ Not Available'}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={loadServerJobs}
                            className="w-full text-xs h-6 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                          >
                            🔄 Test Server Jobs API
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Jobs Section */}
      {serverProcessingAvailable && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
                ☁️ Server-Side Jobs
                <Badge variant="secondary" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                  Runs independently
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleTriggerJobProcessing}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Process Jobs Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadServerJobs}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {serverJobs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">No server jobs found</div>
                <div className="text-sm text-gray-400">
                  Queue bulk tagging operations to see them here
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {serverJobs.slice(0, 10).map((job) => {
                  const statusInfo = serverJobsService.formatJobStatus(job.status);
                  const progress = serverJobsService.getJobProgress(job);
                  const duration = serverJobsService.getJobDuration(job);
                  const eta = serverJobsService.getEstimatedTimeRemaining(job);
                  const canCancel = job.status === 'queued' || job.status === 'running';
                  
                  return (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary" 
                            className={`bg-${statusInfo.color}-50 text-${statusInfo.color}-700 border-${statusInfo.color}-200`}
                          >
                            {statusInfo.text}
                          </Badge>
                          <span className="text-sm font-medium">
                            {job.type === 'bulk_add_tags' ? 'Add Tags' : 'Remove Tags'}
                          </span>
                          {job.status === 'queued' && (
                            <div className="flex items-center gap-1 text-xs text-blue-600">
                              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                              Waiting in queue
                            </div>
                          )}
                          {job.status === 'running' && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                              Processing
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-500">
                            {duration}
                          </div>
                          {canCancel && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to cancel this ${job.status} job?`)) {
                                  try {
                                    await serverJobsService.cancelJob(job.id);
                                    setSuccess('Job cancelled successfully');
                                    loadServerJobs(); // Refresh the job list
                                  } catch (error) {
                                    setError(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                  }
                                }
                              }}
                              className="text-xs px-2 py-1 h-6 border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Segment:</strong> {job.segmentName}
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Tags:</strong> {job.tags.join(', ')}
                      </div>
                      
                      {/* Progress for queued jobs */}
                      {job.status === 'queued' && (
                        <div className="space-y-2">
                          <div className="text-sm text-blue-600">
                            {job.progress.message}
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full animate-pulse w-1/4" />
                          </div>
                          <div className="text-xs text-blue-600">
                            Job will start processing automatically
                          </div>
                        </div>
                      )}
                      
                      {/* Progress for running jobs */}
                      {job.status === 'running' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Progress: {job.progress.current}/{job.progress.total}</span>
                            <div className="flex items-center gap-2">
                              <span>{progress}%</span>
                              {eta !== 'Unknown' && (
                                <span className="text-gray-500">ETA: {eta}</span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600">
                            {job.progress.message}
                          </div>
                          {job.progress.skipped > 0 && (
                            <div className="text-xs text-yellow-600">
                              Skipped: {job.progress.skipped} customers
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Results for completed jobs */}
                      {job.result && (
                        <div className="mt-2 text-sm">
                          <span className={job.result.success ? 'text-green-600' : 'text-red-600'}>
                            {job.result.success ? '✅' : '❌'} 
                            Processed: {job.result.processedCount}, 
                            Skipped: {job.result.skippedCount}
                          </span>
                          {job.result.errors.length > 0 && (
                            <div className="text-red-600 text-xs mt-1">
                              Errors: {job.result.errors.slice(0, 2).join(', ')}
                              {job.result.errors.length > 2 && ` (+${job.result.errors.length - 2} more)`}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
                        <span>Job ID: {job.id}</span>
                        <span>Started: {new Date(job.startTime).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
                
                {serverJobs.length > 10 && (
                  <div className="text-center text-sm text-gray-500">
                    Showing 10 of {serverJobs.length} jobs
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}