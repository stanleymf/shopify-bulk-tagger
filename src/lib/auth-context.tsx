import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check if we have stored credentials or session
        const storedAuth = localStorage.getItem('bulk_tagger_auth');
        if (storedAuth) {
          const authData = JSON.parse(storedAuth);
          if (authData.username && authData.isAuthenticated) {
            setUsername(authData.username);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Create basic auth header
      const credentials = btoa(`${username}:${password}`);
      const authHeader = `Basic ${credentials}`;

      // Test authentication by making a request to a protected endpoint
      const response = await fetch('/api/auth/test', {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        // Authentication successful
        setIsAuthenticated(true);
        setUsername(username);
        
        // Store auth data
        const authData = {
          username,
          isAuthenticated: true,
          timestamp: Date.now(),
        };
        localStorage.setItem('bulk_tagger_auth', JSON.stringify(authData));
        
        return true;
      } else if (response.status === 401) {
        setError('Invalid username or password');
        return false;
      } else {
        setError('Authentication failed. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Clear stored auth data
      localStorage.removeItem('bulk_tagger_auth');
      
      // Reset state
      setIsAuthenticated(false);
      setUsername(null);
      setError(null);
      
      // Optionally call logout endpoint
      try {
        await fetch('/logout', { method: 'GET' });
      } catch (error) {
        // Ignore logout endpoint errors
        console.warn('Logout endpoint call failed:', error);
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setIsAuthenticated(false);
      setUsername(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    username,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 