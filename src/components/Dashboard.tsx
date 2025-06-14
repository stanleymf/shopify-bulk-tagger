import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  RefreshCw, 
  Plus, 
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { shopifyAPI, ShopifyCustomerSegment } from "@/lib/shopify-api";
import { useConfig } from "@/lib/config-context";

export function Dashboard() {
  const { isConnected } = useConfig();
  const [segments, setSegments] = useState<ShopifyCustomerSegment[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load segments on component mount
  useEffect(() => {
    loadSegments();
  }, []);

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

  const handleConnectStore = () => {
    // Navigate to settings page
    window.location.hash = '#settings';
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
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing || !isConnected}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Sync Segments
        </Button>
      </div>

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
          <CardTitle className="text-lg font-medium text-gray-900">Segments Overview</CardTitle>
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
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 truncate">{segment.name}</h3>
                      <Badge variant="secondary">
                        {segment.customer_count || 0} customers
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>ID: {segment.id}</div>
                      {segment.query && (
                        <div className="truncate" title={segment.query}>
                          Query: {segment.query}
                        </div>
                      )}
                      <div>Created: {new Date(segment.created_at).toLocaleDateString()}</div>
                      <div>Updated: {new Date(segment.updated_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}