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
  Hash
} from "lucide-react";
import { shopifyAPI, ShopifyCustomerSegment } from "@/lib/shopify-api";
import { useConfig } from "@/lib/config-context";

export function Dashboard() {
  const { isConnected } = useConfig();
  const [segments, setSegments] = useState<ShopifyCustomerSegment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load segments on component mount
  useEffect(() => {
    loadSegments();
  }, []);

  // Filter segments based on search term
  const filteredSegments = segments.filter(segment => 
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (segment.query && segment.query.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const loadSegments = () => {
    try {
      // Load segments from storage first
      const storedSegments = shopifyAPI.getStoredSegments();
      setSegments(storedSegments);
    } catch (error) {
      console.error('Failed to load segments:', error);
    }
  };

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
      shopifyAPI.setSegmentCountLoading(segmentId, true);
      loadSegments(); // Refresh UI to show loading state

      // Fetch customer count
      const count = await shopifyAPI.getSegmentCustomerCount(segmentId);
      
      // Update segment with count
      shopifyAPI.updateSegmentCustomerCount(segmentId, count);
      loadSegments(); // Refresh UI to show count
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load customer count';
      setError(errorMessage);
      
      // Clear loading state on error
      shopifyAPI.setSegmentCountLoading(segmentId, false);
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

  const totalCustomers = segments.reduce((sum, segment) => sum + (segment.customer_count || 0), 0);
  const lastSync = shopifyAPI.getLastSync();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customer Segments</h1>
          <p className="text-gray-600 mt-1">Manage your Shopify customer segments and their tags</p>
        </div>
        <div className="flex gap-2">
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}