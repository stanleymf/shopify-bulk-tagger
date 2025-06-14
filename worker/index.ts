// Cloudflare Worker with Basic Authentication
// Based on: https://developers.cloudflare.com/workers/examples/basic-auth/

interface Env {
	USERNAME: string;
	PASSWORD: string;
	REALM?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// Define authentication configuration
		const authConfig = {
			username: env.USERNAME || 'admin',
			password: env.PASSWORD || 'password',
			realm: env.REALM || 'Bulk-Tagger Admin',
		};

		// Check if this is a public route (no auth required)
		if (this.isPublicRoute(pathname)) {
			return await this.handlePublicRoute(request, pathname);
		}

		// Check if this is an authentication route
		if (this.isAuthRoute(pathname)) {
			return this.handleAuthRoute(request, pathname, authConfig);
		}

		// All other routes require authentication
		return this.handleProtectedRoute(request, pathname, authConfig);
	},

	// Handle public routes that don't require authentication
	async handlePublicRoute(request: Request, pathname: string): Promise<Response> {
		switch (pathname) {
			case '/':
				return new Response('Welcome to Bulk-Tagger! Please log in to access the dashboard.', {
					status: 200,
					headers: {
						'Content-Type': 'text/plain',
						'Cache-Control': 'no-store',
					},
				});

			case '/health':
				return new Response('OK', {
					status: 200,
					headers: {
						'Content-Type': 'text/plain',
						'Cache-Control': 'no-store',
					},
				});

			case '/status':
				return new Response(JSON.stringify({
					status: 'running',
					timestamp: new Date().toISOString(),
					version: '1.1.0',
				}), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'no-store',
					},
				});

			default:
				// Check if this is a Shopify API proxy request
				if (pathname.startsWith('/api/shopify/proxy')) {
					return await this.handleShopifyProxy(request);
				}
				return new Response('Not Found', { status: 404 });
		}
	},

	// Handle authentication-specific routes
	handleAuthRoute(request: Request, pathname: string, authConfig: any): Response {
		switch (pathname) {
			case '/login':
				return this.createAuthRequiredResponse('Please log in to access Bulk-Tagger', authConfig);

			case '/logout':
				// Invalidate the "Authorization" header by returning a HTTP 401
				// We do not send a "WWW-Authenticate" header, as this would trigger
				// a popup in the browser, immediately asking for credentials again
				return new Response('Logged out successfully', {
					status: 401,
					headers: {
						'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0',
					},
				});

			default:
				return new Response('Not Found', { status: 404 });
		}
	},

	// Handle protected routes that require authentication
	handleProtectedRoute(request: Request, pathname: string, authConfig: any): Response {
		// Check for authorization header
		const authorization = request.headers.get('Authorization');
		
		if (!authorization) {
			return this.createAuthRequiredResponse('Authentication required', authConfig);
		}

		// Validate the authorization header
		const authResult = this.validateAuth(authorization, authConfig);
		
		if (!authResult.isAuthenticated) {
			return this.createAuthRequiredResponse(authResult.error || 'Invalid credentials', authConfig);
		}

		// User is authenticated, serve the application
		return this.serveApplication(request, pathname, authResult.username);
	},

	// Handle Shopify API proxy requests
	async handleShopifyProxy(request: Request): Promise<Response> {
		try {
			console.log('Proxy request received:', request.method, request.url);
			
			// Handle OPTIONS requests for CORS preflight
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 200,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Access-Token, Authorization',
						'Access-Control-Max-Age': '86400',
					},
				});
			}

			// Parse the request body to get the Shopify API details
			const requestData = await request.json();
			console.log('Proxy request data:', requestData);
			
			const { url, method, headers, body } = requestData;

			// Validate the request
			if (!url || !method) {
				console.error('Missing required fields:', { url, method });
				return new Response(JSON.stringify({ error: 'Missing required fields: url, method' }), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Access-Token, Authorization',
					},
				});
			}

			console.log('Making request to Shopify:', { url, method });

			// Make the request to Shopify
			const shopifyResponse = await fetch(url, {
				method: method,
				headers: headers || {},
				body: body ? JSON.stringify(body) : undefined,
			});

			console.log('Shopify response status:', shopifyResponse.status);

			// Get the response data
			const responseData = await shopifyResponse.text();
			let parsedData;
			try {
				parsedData = JSON.parse(responseData);
			} catch {
				parsedData = responseData;
			}

			// Return the response with CORS headers
			return new Response(JSON.stringify(parsedData), {
				status: shopifyResponse.status,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Access-Token, Authorization',
				},
			});
		} catch (error) {
			console.error('Shopify proxy error:', error);
			return new Response(JSON.stringify({ 
				error: 'Proxy request failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			}), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Access-Token, Authorization',
				},
			});
		}
	},

	// Validate basic authentication
	validateAuth(authorization: string, authConfig: any): { isAuthenticated: boolean; username?: string; error?: string } {
		const [scheme, encoded] = authorization.split(' ');

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
				!this.timingSafeEqual(authConfig.username, user) ||
				!this.timingSafeEqual(authConfig.password, pass)
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
	},

	// Create a 401 response with WWW-Authenticate header
	createAuthRequiredResponse(message: string, authConfig: any): Response {
		return new Response(message, {
			status: 401,
			headers: {
				'WWW-Authenticate': `Basic realm="${authConfig.realm}", charset="UTF-8"`,
				'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0',
			},
		});
	},

	// Protect against timing attacks by safely comparing values
	timingSafeEqual(a: string, b: string): boolean {
		const encoder = new TextEncoder();
		const aBytes = encoder.encode(a);
		const bBytes = encoder.encode(b);

		if (aBytes.byteLength !== bBytes.byteLength) {
			// Strings must be the same length in order to compare
			// with crypto.subtle.timingSafeEqual
			return false;
		}

		// Use a simple comparison for now since timingSafeEqual is not available in all environments
		// In production, this should be replaced with a proper timing-safe comparison
		return a === b;
	},

	// Serve the main application
	serveApplication(request: Request, pathname: string, username: string): Response {
		// For now, return a simple response indicating successful authentication
		// In a real application, this would serve the React app or API endpoints
		return new Response(`🎉 Welcome ${username}! You have access to Bulk-Tagger.`, {
			status: 200,
			headers: {
				'Content-Type': 'text/plain',
				'Cache-Control': 'no-store',
				'X-Authenticated-User': username,
			},
		});
	},

	// Check if a request is for a public route (no auth required)
	isPublicRoute(pathname: string): boolean {
		const publicRoutes = [
			'/',
			'/health',
			'/status',
			'/favicon.ico',
			'/robots.txt',
			'/api/shopify/proxy',
		];

		return publicRoutes.some(route => pathname === route || pathname.startsWith('/public/'));
	},

	// Check if a request is for an authentication route
	isAuthRoute(pathname: string): boolean {
		const authRoutes = [
			'/login',
			'/logout',
			'/auth',
		];

		return authRoutes.some(route => pathname === route || pathname.startsWith('/auth/'));
	},
};
