import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage, ShopifyConfig } from './storage';
import { shopifyAPI } from './shopify-api';

interface ConfigContextType {
  shopifyConfig: ShopifyConfig | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  updateConfig: (config: Partial<ShopifyConfig>) => void;
  clearConfig: () => void;
  refreshConnection: () => void;
  clearError: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [shopifyConfig, setShopifyConfig] = useState<ShopifyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    try {
      const config = storage.getShopifyConfig();
      if (config) {
        setShopifyConfig(config);
        
        // Initialize Shopify API if connected
        if (config.isConnected && config.shopDomain && config.accessToken) {
          shopifyAPI.initialize(config.shopDomain, config.accessToken);
        }
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setError('Failed to load saved configuration');
    }
  };

  const updateConfig = (config: Partial<ShopifyConfig>) => {
    try {
      const updatedConfig = {
        ...shopifyConfig,
        ...config,
        updatedAt: new Date().toISOString(),
      } as ShopifyConfig;

      storage.saveShopifyConfig(updatedConfig);
      setShopifyConfig(updatedConfig);
      setError(null);

      // Initialize API if connected
      if (updatedConfig.isConnected && updatedConfig.shopDomain && updatedConfig.accessToken) {
        shopifyAPI.initialize(updatedConfig.shopDomain, updatedConfig.accessToken);
      }
    } catch (error) {
      console.error('Failed to update configuration:', error);
      setError('Failed to save configuration');
    }
  };

  const clearConfig = () => {
    try {
      storage.clearShopifyConfig();
      shopifyAPI.clearStoredData();
      setShopifyConfig(null);
      setError(null);
    } catch (error) {
      console.error('Failed to clear configuration:', error);
      setError('Failed to clear configuration');
    }
  };

  const refreshConnection = () => {
    loadConfig();
  };

  const clearError = () => {
    setError(null);
  };

  const value: ConfigContextType = {
    shopifyConfig,
    isConnected: !!(shopifyConfig && shopifyConfig.isConnected),
    isLoading,
    error,
    updateConfig,
    clearConfig,
    refreshConnection,
    clearError,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
} 