import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Store, 
  Key, 
  Globe, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2
} from "lucide-react";
import { useConfig } from "@/lib/config-context";
import { shopifyAPI } from "@/lib/shopify-api";

export function Settings() {
  const { shopifyConfig, isConnected, updateConfig, clearConfig } = useConfig();
  const [config, setConfig] = useState({
    shopDomain: '',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load configuration from context on component mount
  useEffect(() => {
    if (shopifyConfig) {
      setConfig({
        shopDomain: shopifyConfig.shopDomain || '',
        apiKey: shopifyConfig.apiKey || '',
        apiSecret: shopifyConfig.apiSecret || '',
        accessToken: shopifyConfig.accessToken || '',
      });
    }
  }, [shopifyConfig]);

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!config.shopDomain || !config.apiKey || !config.apiSecret || !config.accessToken) {
        throw new Error('Please fill in all required fields');
      }

      // Clean shop domain (remove protocol if present)
      const cleanDomain = config.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // Initialize Shopify API with the configuration
      shopifyAPI.initialize(cleanDomain, config.accessToken);
      
      // Test the connection
      const isConnected = await shopifyAPI.testConnection();
      
      if (!isConnected) {
        throw new Error('Failed to connect to Shopify store');
      }

      // Save configuration to context
      updateConfig({
        shopDomain: cleanDomain,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        accessToken: config.accessToken,
        isConnected: true,
      });
      
      setSuccess('Shopify store connected successfully! You can now sync customer segments.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Shopify';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!config.shopDomain || !config.accessToken) {
        throw new Error('Please enter your shop domain and access token first');
      }

      // Clean shop domain
      const cleanDomain = config.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // Initialize API temporarily for testing
      shopifyAPI.initialize(cleanDomain, config.accessToken);
      
      // Test connection
      const isConnected = await shopifyAPI.testConnection();
      
      if (isConnected) {
        setSuccess('Connection test successful! Your credentials are valid.');
      } else {
        throw new Error('Connection test failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSegments = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!shopifyAPI.isInitialized()) {
        throw new Error('Please connect your Shopify store first');
      }

      // Fetch customer segments from Shopify
      const segments = await shopifyAPI.getCustomerSegments();
      
      // Update config with sync timestamp
      updateConfig({
        lastSync: new Date().toISOString(),
      });
      
      setSuccess(`Successfully synced ${segments.length} customer segments!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync segments';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    try {
      clearConfig();
      
      // Reset component state
      setConfig({
        shopDomain: '',
        apiKey: '',
        apiSecret: '',
        accessToken: '',
      });
      
      setSuccess('Store disconnected successfully');
    } catch (error) {
      setError('Failed to disconnect store');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your Shopify store integration and authentication</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            
            {shopifyConfig?.lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Sync</span>
                <span className="text-sm text-gray-900">{formatDate(shopifyConfig.lastSync)}</span>
              </div>
            )}

            {shopifyConfig?.updatedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Updated</span>
                <span className="text-sm text-gray-900">{formatDate(shopifyConfig.updatedAt)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Button 
                onClick={handleTestConnection} 
                variant="outline" 
                size="sm" 
                disabled={isLoading || !config.shopDomain || !config.accessToken}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              
              <Button 
                onClick={handleSyncSegments} 
                variant="outline" 
                size="sm" 
                disabled={isLoading || !isConnected}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Segments
              </Button>

              {isConnected && (
                <Button 
                  onClick={handleDisconnect} 
                  variant="outline" 
                  size="sm" 
                  disabled={isLoading}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect Store
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shopify Configuration */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Shopify Store Configuration
              </CardTitle>
              <CardDescription>
                Enter your Shopify store credentials to enable customer segment synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="shop-domain" className="text-sm font-medium text-gray-700">
                  Shop Domain *
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">https://</span>
                  <Input
                    id="shop-domain"
                    value={config.shopDomain}
                    onChange={(e) => setConfig(prev => ({ ...prev, shopDomain: e.target.value }))}
                    placeholder="your-store.myshopify.com"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-sm font-medium text-gray-700">
                  API Key *
                </Label>
                <Input
                  id="api-key"
                  type={showSecrets ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your Shopify API key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-secret" className="text-sm font-medium text-gray-700">
                  API Secret *
                </Label>
                <Input
                  id="api-secret"
                  type={showSecrets ? "text" : "password"}
                  value={config.apiSecret}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                  placeholder="Enter your Shopify API secret"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-token" className="text-sm font-medium text-gray-700">
                  Access Token *
                </Label>
                <Input
                  id="access-token"
                  type={showSecrets ? "text" : "password"}
                  value={config.accessToken}
                  onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder="Enter your Shopify access token"
                />
                <p className="text-xs text-gray-500">
                  This is required for API access. You can generate this in your Shopify admin under Apps &gt; Private apps.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="show-secrets"
                  checked={showSecrets}
                  onCheckedChange={setShowSecrets}
                />
                <Label htmlFor="show-secrets" className="text-sm text-gray-600">
                  {showSecrets ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  Show credentials
                </Label>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Need help?</h4>
                  <p className="text-sm text-gray-600">
                    Get your API credentials from your Shopify admin
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Shopify Docs
                </Button>
              </div>

              <Button 
                onClick={handleSaveConfig} 
                disabled={isLoading || !config.shopDomain || !config.apiKey || !config.apiSecret || !config.accessToken}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                {isConnected ? 'Update Configuration' : 'Connect Store'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 