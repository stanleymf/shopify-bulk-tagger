import { useState } from "react";
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
  EyeOff
} from "lucide-react";

interface ShopifyConfig {
  shopDomain: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  isConnected: boolean;
  lastSync?: string;
}

export function Settings() {
  const [config, setConfig] = useState<ShopifyConfig>({
    shopDomain: '',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    isConnected: false,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!config.shopDomain || !config.apiKey || !config.apiSecret) {
        throw new Error('Please fill in all required fields');
      }

      // Simulate API call to test connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update config with connection status
      setConfig(prev => ({
        ...prev,
        isConnected: true,
        lastSync: new Date().toISOString()
      }));
      
      setSuccess('Shopify store connected successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Shopify');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess('Connection test successful! Your credentials are valid.');
    } catch (err) {
      setError('Connection test failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSegments = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate segment sync
      await new Promise(resolve => setTimeout(resolve, 3000));
      setConfig(prev => ({
        ...prev,
        lastSync: new Date().toISOString()
      }));
      setSuccess('Customer segments synced successfully!');
    } catch (err) {
      setError('Failed to sync segments. Please try again.');
    } finally {
      setIsLoading(false);
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
              <Badge variant={config.isConnected ? "default" : "secondary"}>
                {config.isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            
            {config.lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Sync</span>
                <span className="text-sm text-gray-900">{formatDate(config.lastSync)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Button 
                onClick={handleTestConnection} 
                variant="outline" 
                size="sm" 
                disabled={isLoading || !config.shopDomain}
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
                disabled={isLoading || !config.isConnected}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Segments
              </Button>
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
                  Access Token
                </Label>
                <Input
                  id="access-token"
                  type={showSecrets ? "text" : "password"}
                  value={config.accessToken}
                  onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder="Enter your Shopify access token (optional)"
                />
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
                disabled={isLoading || !config.shopDomain || !config.apiKey || !config.apiSecret}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                {config.isConnected ? 'Update Configuration' : 'Connect Store'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 