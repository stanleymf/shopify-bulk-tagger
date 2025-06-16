// Cloudflare Worker with Basic Authentication and D1 Database
// Server-side storage for Bulk-Tagger application

import { DatabaseService } from './database';
import { JobProcessor, queueServerJob } from './job-processor';
import type { D1Database } from './types';

interface Env {
	USERNAME: string;
	PASSWORD: string;
	REALM?: string;
	DB: D1Database; // D1 database binding
}

// Global job processor instance
let jobProcessor: JobProcessor | null = null;

const handler = {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// Initialize database service
		const db = new DatabaseService(env.DB);

		// Initialize job processor if not already done
		if (!jobProcessor) {
			jobProcessor = new JobProcessor(db);
		}

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

		// Check if this is an API route (requires auth)
		if (pathname.startsWith('/api/')) {
			return await this.handleAPIRoute(request, pathname, authConfig, db);
		}

		// Check if this is an authentication route
		if (this.isAuthRoute(pathname)) {
			return this.handleAuthRoute(request, pathname, authConfig);
		}

		// For all other routes (React app routes), serve without authentication
		// The React app will handle its own authentication internally
		return new Response(null, {
			status: 302,
			headers: {
				'Location': '/',
			},
		});
	},

	// Handle API routes with authentication
	async handleAPIRoute(request: Request, pathname: string, authConfig: any, db: DatabaseService): Promise<Response> {
		console.log(`🚨 API ROUTE CALLED: ${request.method} ${pathname}`);
		// Handle CORS preflight
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

		// Allow health check without authentication
		if (pathname === '/api/health') {
			return new Response(JSON.stringify({
				status: 'ok',
				timestamp: new Date().toISOString(),
				database: 'connected'
			}), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

		// Verify authentication for other API routes
		const authResult = await this.verifyAuthFromRequest(request, authConfig, db);
		if (!authResult.isAuthenticated) {
			return new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

		try {
			// Route API requests
			if (pathname === '/api/shopify/config') {
				return await this.handleShopifyConfig(request, authResult.userId!, db);
			} else if (pathname === '/api/segments') {
				return await this.handleSegments(request, authResult.userId!, db);
			} else if (pathname === '/api/background-jobs') {
				return await this.handleBackgroundJobs(request, authResult.userId!, db);
			} else if (pathname === '/api/server-jobs') {
				return await this.handleServerJobs(request, authResult.userId!, db);
			} else if (pathname === '/api/server-jobs/process') {
				return await this.handleProcessJobs(request, authResult.userId!, db);
			} else if (pathname.startsWith('/api/server-jobs/') && pathname.endsWith('/cancel')) {
				const jobId = pathname.split('/')[3]; // Extract job ID from path
				return await this.handleCancelJob(request, authResult.userId!, jobId, db);
			} else if (pathname === '/api/auth/test') {
				// Authentication test endpoint for React app
				return new Response(JSON.stringify({ 
					authenticated: true, 
					username: authResult.username,
					timestamp: new Date().toISOString()
				}), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} else if (pathname === '/api/settings') {
				return await this.handleSettings(request, authResult.userId!, db);
			} else if (pathname.startsWith('/api/shopify/proxy')) {
				return await this.handleShopifyProxy(request);
			} else {
				return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
					status: 404,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
		} catch (error) {
			console.error('API route error:', error);
			return new Response(JSON.stringify({ 
				error: 'Internal server error',
				details: error instanceof Error ? error.message : 'Unknown error'
			}), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
	},

	// Handle server-side jobs API
	async handleServerJobs(request: Request, userId: number, db: DatabaseService): Promise<Response> {
		if (request.method === 'GET') {
			// Get all jobs for user
			const jobs = await db.getAllBackgroundJobs(userId);
			return new Response(JSON.stringify(jobs), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} else if (request.method === 'POST') {
			try {
				// Queue a new server-side job
				const jobData = await request.json();
				console.log('Queueing server job:', { userId, jobData });
				
				const jobId = await queueServerJob(
					db,
					userId,
					jobData.type,
					jobData.segmentId,
					jobData.segmentName,
					jobData.tags
				);
				
				console.log('Server job queued successfully:', jobId);
				
				return new Response(JSON.stringify({ 
					success: true, 
					jobId,
					message: 'Job queued for server-side processing'
				}), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				console.error('Error queueing server job:', error);
				return new Response(JSON.stringify({ 
					error: 'Failed to queue server job',
					details: error instanceof Error ? error.message : 'Unknown error'
				}), {
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Handle job processing trigger
	async handleProcessJobs(request: Request, userId: number, db: DatabaseService): Promise<Response> {
		console.log(`🚨 CRITICAL TEST: handleProcessJobs method called for user ${userId}`);
		if (request.method === 'POST') {
			try {
				console.log(`🔧 handleProcessJobs called for user ${userId}`);
				
				if (!jobProcessor) {
					console.log(`🔧 Creating new JobProcessor instance`);
					jobProcessor = new JobProcessor(db);
					console.log(`✅ JobProcessor instance created successfully`);
				} else {
					console.log(`🔧 Using existing JobProcessor instance`);
				}

				console.log(`🔧 About to call processUserJobs for user ${userId}`);
				
				// Add specific error handling around processUserJobs
				try {
					await jobProcessor.processUserJobs(userId);
					console.log(`✅ processUserJobs completed successfully for user ${userId}`);
				} catch (processError) {
					console.error(`💥 CRITICAL ERROR in processUserJobs for user ${userId}:`, processError);
					console.error(`💥 Error name: ${processError instanceof Error ? processError.name : 'Unknown'}`);
					console.error(`💥 Error message: ${processError instanceof Error ? processError.message : String(processError)}`);
					console.error(`💥 Error stack: ${processError instanceof Error ? processError.stack : 'No stack trace'}`);
					throw processError; // Re-throw to be caught by outer try-catch
				}
				
				const stats = jobProcessor.getStats();
				console.log(`🔧 Job processor stats:`, stats);
				
				return new Response(JSON.stringify({ 
					success: true,
					message: 'Job processing triggered - VERSION 2.0',
					stats,
					debug: {
						userId,
						timestamp: new Date().toISOString(),
						methodCalled: 'handleProcessJobs',
						processUserJobsCalled: true,
						version: '2.0'
					}
				}), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				console.error(`💥 Error in handleProcessJobs for user ${userId}:`, error);
				return new Response(JSON.stringify({ 
					error: 'Failed to process jobs',
					details: error instanceof Error ? error.message : 'Unknown error'
				}), {
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Handle job cancellation
	async handleCancelJob(request: Request, userId: number, jobId: string, db: DatabaseService): Promise<Response> {
		if (request.method === 'POST') {
			try {
				// Get the job to verify it belongs to this user
				const job = await db.getBackgroundJob(userId, jobId);
				if (!job) {
					return new Response(JSON.stringify({ 
						error: 'Job not found',
						message: 'The specified job does not exist or does not belong to you'
					}), {
						status: 404,
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						},
					});
				}

				// Check if job can be cancelled
				if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
					return new Response(JSON.stringify({ 
						error: 'Cannot cancel job',
						message: `Job is already ${job.status} and cannot be cancelled`
					}), {
						status: 400,
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						},
					});
				}

				// Cancel the job
				await db.updateBackgroundJob(userId, jobId, {
					status: 'cancelled',
					end_time: new Date().toISOString(),
					last_update: new Date().toISOString()
				});

				// If there's an active job processor, cancel the job there too
				if (jobProcessor) {
					await jobProcessor.cancelJob(jobId);
				}

				console.log(`🚫 Cancelled job ${jobId} for user ${userId}`);
				
				return new Response(JSON.stringify({ 
					success: true,
					message: 'Job cancelled successfully'
				}), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				console.error('Error cancelling job:', error);
				return new Response(JSON.stringify({ 
					error: 'Failed to cancel job',
					details: error instanceof Error ? error.message : 'Unknown error'
				}), {
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Handle Shopify configuration API
	async handleShopifyConfig(request: Request, userId: number, db: DatabaseService): Promise<Response> {
		if (request.method === 'GET') {
			const config = await db.getShopifyConfig(userId);
			
			// Convert snake_case to camelCase for response
			const responseConfig = config ? {
				id: config.id,
				userId: config.user_id,
				shopDomain: config.shop_domain,
				apiKey: config.api_key,
				apiSecret: config.api_secret,
				accessToken: config.access_token,
				isConnected: config.is_connected,
				lastSync: config.last_sync,
				createdAt: config.created_at,
				updatedAt: config.updated_at
			} : null;
			
			return new Response(JSON.stringify(responseConfig), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} else if (request.method === 'POST' || request.method === 'PUT') {
			const configData = await request.json();
			
			// Convert camelCase to snake_case for database
			const dbConfigData = {
				shop_domain: configData.shopDomain,
				api_key: configData.apiKey,
				api_secret: configData.apiSecret,
				access_token: configData.accessToken,
				is_connected: configData.isConnected,
				last_sync: configData.lastSync
			};
			
			await db.saveShopifyConfig(userId, dbConfigData);
			const updatedConfig = await db.getShopifyConfig(userId);
			
			// Convert snake_case back to camelCase for response
			const responseConfig = updatedConfig ? {
				id: updatedConfig.id,
				userId: updatedConfig.user_id,
				shopDomain: updatedConfig.shop_domain,
				apiKey: updatedConfig.api_key,
				apiSecret: updatedConfig.api_secret,
				accessToken: updatedConfig.access_token,
				isConnected: updatedConfig.is_connected,
				lastSync: updatedConfig.last_sync,
				createdAt: updatedConfig.created_at,
				updatedAt: updatedConfig.updated_at
			} : null;
			
			return new Response(JSON.stringify(responseConfig), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Handle segments API
	async handleSegments(request: Request, userId: number, db: DatabaseService): Promise<Response> {
		if (request.method === 'GET') {
			const segments = await db.getSegments(userId);
			return new Response(JSON.stringify(segments), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} else if (request.method === 'POST') {
			const segments = await request.json();
			await db.saveSegments(userId, segments);
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Handle background jobs API
	async handleBackgroundJobs(request: Request, userId: number, db: DatabaseService): Promise<Response> {
		if (request.method === 'GET') {
			const jobs = await db.getAllBackgroundJobs(userId);
			return new Response(JSON.stringify(jobs), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} else if (request.method === 'POST') {
			const jobData = await request.json();
			await db.createBackgroundJob(userId, jobData);
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Handle settings API
	async handleSettings(request: Request, userId: number, db: DatabaseService): Promise<Response> {
		if (request.method === 'GET') {
			const url = new URL(request.url);
			const key = url.searchParams.get('key');
			
			if (key) {
				// Get specific setting
				const value = await db.getSetting(userId, key);
				return new Response(JSON.stringify({ key, value }), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} else {
				// Get all settings
				const settings = await db.getAllSettings(userId);
				return new Response(JSON.stringify(settings), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
		} else if (request.method === 'POST') {
			const { key, value } = await request.json();
			if (!key) {
				return new Response(JSON.stringify({ error: 'Setting key is required' }), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
			
			await db.saveSetting(userId, key, value);
			return new Response(JSON.stringify({ success: true, key, value }), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} else if (request.method === 'DELETE') {
			const url = new URL(request.url);
			const key = url.searchParams.get('key');
			
			if (!key) {
				return new Response(JSON.stringify({ error: 'Setting key is required' }), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}
			
			await db.deleteSetting(userId, key);
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
		
		return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},

	// Verify authentication from request headers
	async verifyAuthFromRequest(request: Request, authConfig: any, db: DatabaseService): Promise<{ isAuthenticated: boolean; userId?: number; username?: string; error?: string }> {
		const authorization = request.headers.get('Authorization');
		
		if (!authorization) {
			return { isAuthenticated: false, error: 'No authorization header' };
		}

		const authResult = this.validateAuth(authorization, authConfig);
		
		if (!authResult.isAuthenticated) {
			return authResult;
		}

		// Look up or create user in database
		try {
			let user = await db.getUserByUsername(authResult.username!);
			
			if (!user) {
				// Create user if it doesn't exist (for basic auth setup)
				const newUser = await db.createUser(authResult.username!, 'basic_auth_user');
				return {
					isAuthenticated: true,
					userId: newUser.id,
					username: authResult.username
				};
			}

			return {
				isAuthenticated: true,
				userId: user.id,
				username: authResult.username
			};
		} catch (error) {
			console.error('Error looking up/creating user:', error);
			return {
				isAuthenticated: false,
				error: 'Database error during authentication'
			};
		}
	},

	// Handle public routes that don't require authentication
	async handlePublicRoute(request: Request, pathname: string): Promise<Response> {
		switch (pathname) {
			case '/':
				// The React app should handle authentication, not the worker
				// Let the static assets be served directly by Cloudflare
				return new Response(null, {
					status: 302,
					headers: {
						'Location': '/index.html',
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
				
				// For other routes, let static assets be served or return 404
				return new Response('Not Found', { status: 404 });
		}
	},

	// Handle authentication-specific routes
	handleAuthRoute(request: Request, pathname: string, authConfig: any): Response {
		switch (pathname) {
			case '/login':
				return this.createAuthRequiredResponse('Please log in to access Bulk-Tagger', authConfig);

			case '/logout':
				// Return a successful logout response for the React app
				return new Response(JSON.stringify({ 
					success: true, 
					message: 'Logged out successfully',
					timestamp: new Date().toISOString()
				}), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0',
						'Access-Control-Allow-Origin': '*',
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
			'/index.html', // Main HTML file
		];

		// Allow all static assets (CSS, JS, images, etc.)
		const staticAssetExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
		const isStaticAsset = staticAssetExtensions.some(ext => pathname.endsWith(ext));
		
		// Allow all assets folder content
		const isAssetPath = pathname.startsWith('/assets/');

		return publicRoutes.some(route => pathname === route || pathname.startsWith('/public/')) || isStaticAsset || isAssetPath;
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

	// Handle scheduled events (cron triggers)
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('🕐 Scheduled event triggered:', event.cron);
		
		try {
			const db = new DatabaseService(env.DB);
			
			if (!jobProcessor) {
				jobProcessor = new JobProcessor(db);
			}

			// Process all pending jobs for all users
			await jobProcessor.processAllPendingJobs();
			
			console.log('✅ Scheduled job processing completed');
		} catch (error) {
			console.error('❌ Scheduled job processing failed:', error);
		}
	}
};

export default handler;
