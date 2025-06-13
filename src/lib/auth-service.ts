// Authentication Service for Shopify OAuth
// Handles OAuth flow and token management

export interface AuthState {
  isAuthenticated: boolean;
  shopDomain: string | null;
  accessToken: string | null;
  scopes: string[];
  expiresAt: number | null;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

class AuthService {
  private config: OAuthConfig | null = null;
  private state: AuthState = {
    isAuthenticated: false,
    shopDomain: null,
    accessToken: null,
    scopes: [],
    expiresAt: null,
  };

  // Initialize the auth service with OAuth configuration
  initialize(config: OAuthConfig): void {
    this.config = config;
    this.loadStoredAuth();
  }

  // Get current authentication state
  getAuthState(): AuthState {
    return { ...this.state };
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.state.isAuthenticated && this.hasValidToken();
  }

  // Check if access token is still valid
  private hasValidToken(): boolean {
    if (!this.state.expiresAt) return false;
    return Date.now() < this.state.expiresAt;
  }

  // Initiate OAuth flow
  initiateOAuth(shopDomain: string): string {
    if (!this.config) {
      throw new Error('Auth service not initialized');
    }

    const state = this.generateState();
    const scopes = this.config.scopes.join(',');
    
    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${this.config.clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(this.config.redirectUri)}&` +
      `state=${state}`;

    // Store state for verification
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_shop', shopDomain);

    return authUrl;
  }

  // Handle OAuth callback
  async handleOAuthCallback(code: string, state: string, shop: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Auth service not initialized');
    }

    // Verify state
    const storedState = sessionStorage.getItem('oauth_state');
    const storedShop = sessionStorage.getItem('oauth_shop');

    if (state !== storedState || shop !== storedShop) {
      throw new Error('OAuth state verification failed');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code, shop);
      
      // Update auth state
      this.state = {
        isAuthenticated: true,
        shopDomain: shop,
        accessToken: tokenResponse.access_token,
        scopes: tokenResponse.scope.split(','),
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      };

      // Store auth state
      this.storeAuthState();

      // Clean up session storage
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_shop');

      return true;
    } catch (error) {
      console.error('OAuth token exchange failed:', error);
      return false;
    }
  }

  // Exchange authorization code for access token
  private async exchangeCodeForToken(code: string, shop: string): Promise<any> {
    if (!this.config) {
      throw new Error('Auth service not initialized');
    }

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return await response.json();
  }

  // Logout user
  logout(): void {
    this.state = {
      isAuthenticated: false,
      shopDomain: null,
      accessToken: null,
      scopes: [],
      expiresAt: null,
    };

    // Clear stored auth state
    localStorage.removeItem('bulk_tagger_auth');
  }

  // Get access token for API calls
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.state.accessToken;
  }

  // Get shop domain
  getShopDomain(): string | null {
    return this.state.shopDomain;
  }

  // Generate random state for OAuth
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Store auth state in localStorage
  private storeAuthState(): void {
    localStorage.setItem('bulk_tagger_auth', JSON.stringify(this.state));
  }

  // Load auth state from localStorage
  private loadStoredAuth(): void {
    try {
      const stored = localStorage.getItem('bulk_tagger_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          this.state = parsed;
        } else {
          // Token expired, clear storage
          localStorage.removeItem('bulk_tagger_auth');
        }
      }
    } catch (error) {
      console.error('Failed to load stored auth state:', error);
      localStorage.removeItem('bulk_tagger_auth');
    }
  }

  // Refresh access token (if needed)
  async refreshToken(): Promise<boolean> {
    // Note: Shopify doesn't provide refresh tokens in the standard OAuth flow
    // This would need to be implemented if using Shopify's app bridge or other methods
    return false;
  }

  // Validate required scopes
  hasRequiredScopes(requiredScopes: string[]): boolean {
    if (!this.state.isAuthenticated) return false;
    
    return requiredScopes.every(scope => 
      this.state.scopes.some(userScope => 
        userScope === scope || userScope.endsWith(`:${scope}`)
      )
    );
  }
}

// Export singleton instance
export const authService = new AuthService(); 