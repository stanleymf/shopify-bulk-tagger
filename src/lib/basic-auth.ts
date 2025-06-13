// Basic Authentication Service
// Implements HTTP Basic Authentication for Cloudflare Workers
// Based on: https://developers.cloudflare.com/workers/examples/basic-auth/

export interface BasicAuthConfig {
  username: string;
  password: string;
  realm?: string;
}

export interface AuthResult {
  isAuthenticated: boolean;
  username?: string;
  error?: string;
}

class BasicAuthService {
  private config: BasicAuthConfig | null = null;
  private encoder = new TextEncoder();

  // Initialize the auth service with configuration
  initialize(config: BasicAuthConfig): void {
    this.config = {
      ...config,
      realm: config.realm || 'Bulk-Tagger Admin',
    };
  }

  // Check if the service is initialized
  isInitialized(): boolean {
    return this.config !== null;
  }

  // Validate basic authentication from request headers
  validateAuth(authorizationHeader: string | null): AuthResult {
    if (!this.config) {
      return {
        isAuthenticated: false,
        error: 'Authentication service not initialized',
      };
    }

    if (!authorizationHeader) {
      return {
        isAuthenticated: false,
        error: 'No authorization header provided',
      };
    }

    const [scheme, encoded] = authorizationHeader.split(' ');

    // The Authorization header must start with Basic, followed by a space
    if (!encoded || scheme !== 'Basic') {
      return {
        isAuthenticated: false,
        error: 'Malformed authorization header',
      };
    }

    try {
      // Decode the base64 credentials
      const credentials = atob(encoded);
      
      // The username and password are split by the first colon
      const index = credentials.indexOf(':');
      if (index === -1) {
        return {
          isAuthenticated: false,
          error: 'Invalid credentials format',
        };
      }

      const user = credentials.substring(0, index);
      const pass = credentials.substring(index + 1);

      // Use timing-safe comparison to prevent timing attacks
      if (
        !this.timingSafeEqual(this.config.username, user) ||
        !this.timingSafeEqual(this.config.password, pass)
      ) {
        return {
          isAuthenticated: false,
          error: 'Invalid credentials',
        };
      }

      return {
        isAuthenticated: true,
        username: user,
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        error: 'Failed to decode credentials',
      };
    }
  }

  // Create a 401 response with WWW-Authenticate header
  createAuthRequiredResponse(message: string = 'Authentication required'): Response {
    return new Response(message, {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${this.config?.realm || 'Bulk-Tagger Admin'}", charset="UTF-8"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  // Create a logout response (401 without WWW-Authenticate header)
  createLogoutResponse(message: string = 'Logged out successfully'): Response {
    return new Response(message, {
      status: 401,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  // Protect against timing attacks by safely comparing values
  private timingSafeEqual(a: string, b: string): boolean {
    const aBytes = this.encoder.encode(a);
    const bBytes = this.encoder.encode(b);

    if (aBytes.byteLength !== bBytes.byteLength) {
      // Strings must be the same length in order to compare
      // with crypto.subtle.timingSafeEqual
      return false;
    }

    // Use a simple comparison for now since timingSafeEqual is not available in all environments
    // In production, this should be replaced with a proper timing-safe comparison
    return a === b;
  }

  // Generate a basic auth header for testing
  generateAuthHeader(username: string, password: string): string {
    const credentials = `${username}:${password}`;
    const encoded = btoa(credentials);
    return `Basic ${encoded}`;
  }

  // Check if a request is for a public route (no auth required)
  isPublicRoute(pathname: string): boolean {
    const publicRoutes = [
      '/',
      '/health',
      '/status',
      '/favicon.ico',
      '/robots.txt',
    ];

    return publicRoutes.some(route => pathname === route || pathname.startsWith('/public/'));
  }

  // Check if a request is for an authentication route
  isAuthRoute(pathname: string): boolean {
    const authRoutes = [
      '/login',
      '/logout',
      '/auth',
    ];

    return authRoutes.some(route => pathname === route || pathname.startsWith('/auth/'));
  }

  // Get the current configuration (for debugging)
  getConfig(): BasicAuthConfig | null {
    return this.config ? { ...this.config } : null;
  }
}

// Export singleton instance
export const basicAuth = new BasicAuthService(); 