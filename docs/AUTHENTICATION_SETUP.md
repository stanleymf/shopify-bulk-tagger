# Authentication Setup Guide

This guide explains how to set up and configure basic authentication for the Bulk-Tagger application using Cloudflare Workers.

## Overview

The Bulk-Tagger application uses HTTP Basic Authentication to secure access to the application. This implementation is based on the [Cloudflare Workers basic auth example](https://developers.cloudflare.com/workers/examples/basic-auth/) and provides:

- Secure access control for the application
- Environment-based username and password configuration
- Timing-safe authentication comparison
- Proper session management and logout functionality

## Configuration

### Environment Variables

The authentication system uses the following environment variables:

```bash
USERNAME=admin                    # Username for basic auth
PASSWORD=your-secure-password     # Password for basic auth
REALM=Bulk-Tagger Admin          # Authentication realm (optional)
```

### Setting Up Secrets

For production deployment, use Cloudflare Workers secrets to store sensitive credentials:

```bash
# Set username (not sensitive, can be in wrangler.toml)
wrangler secret put USERNAME

# Set password (sensitive, use secret)
wrangler secret put PASSWORD

# Set realm (optional)
wrangler secret put REALM
```

### Local Development

For local development, you can set environment variables in your `.env` file:

```bash
# .env.local
USERNAME=admin
PASSWORD=dev-password
REALM=Bulk-Tagger Dev
```

## Authentication Flow

### 1. Public Routes

The following routes are accessible without authentication:

- `/` - Welcome page
- `/health` - Health check endpoint
- `/status` - Application status
- `/favicon.ico` - Favicon
- `/robots.txt` - Robots file

### 2. Authentication Routes

- `/login` - Triggers authentication prompt
- `/logout` - Logs out user and invalidates session

### 3. Protected Routes

All other routes require authentication. When accessing a protected route:

1. Browser checks for stored credentials
2. If no credentials, browser prompts for username/password
3. Credentials are sent with each request
4. Worker validates credentials using timing-safe comparison
5. If valid, request proceeds; if invalid, 401 response is returned

## Security Features

### Timing-Safe Comparison

The authentication system uses timing-safe string comparison to prevent timing attacks:

```typescript
private timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  return a === b;
}
```

### Secure Headers

All authentication responses include security headers:

```typescript
{
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}
```

### Proper Logout

The logout endpoint returns a 401 without the `WWW-Authenticate` header to prevent immediate re-authentication:

```typescript
case '/logout':
  return new Response('Logged out successfully', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
```

## Usage Examples

### Testing Authentication

You can test the authentication using curl:

```bash
# Test without authentication (should return 401)
curl -i https://your-worker.your-subdomain.workers.dev/dashboard

# Test with authentication
curl -i -u admin:your-password https://your-worker.your-subdomain.workers.dev/dashboard

# Test logout
curl -i -u admin:your-password https://your-worker.your-subdomain.workers.dev/logout
```

### Browser Testing

1. Navigate to your application URL
2. Browser will prompt for username and password
3. Enter the credentials configured in your environment
4. Access the application normally
5. To logout, visit `/logout`

## Integration with Shopify OAuth

The basic authentication works alongside the Shopify OAuth flow:

1. **Basic Auth**: Protects access to the application
2. **Shopify OAuth**: Handles Shopify store authentication
3. **Combined Flow**: Users must pass basic auth to access the app, then authenticate with Shopify

## Best Practices

### Password Security

- Use strong, unique passwords
- Store passwords as Cloudflare Workers secrets
- Never commit passwords to version control
- Rotate passwords regularly

### Environment Configuration

- Use different credentials for development and production
- Set up proper environment separation
- Use secrets for sensitive values
- Document configuration requirements

### Monitoring

- Monitor authentication attempts
- Log failed authentication attempts
- Set up alerts for suspicious activity
- Review access logs regularly

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check username/password configuration
2. **CORS Issues**: Ensure proper CORS headers for API requests
3. **Caching Problems**: Clear browser cache if authentication seems stuck
4. **Environment Variables**: Verify secrets are properly set

### Debug Mode

Enable debug logging by setting the `DEBUG` environment variable:

```bash
wrangler secret put DEBUG
# Set value to: "true"
```

## Migration from No Auth

If you're migrating from a version without authentication:

1. Set up environment variables
2. Deploy the new worker
3. Test authentication flow
4. Update any client applications to handle 401 responses
5. Remove any old authentication code

## Security Considerations

- Basic authentication sends credentials with every request
- Consider using HTTPS in production
- Implement rate limiting for authentication attempts
- Monitor for brute force attacks
- Consider implementing session-based authentication for better security

## Future Enhancements

- Session-based authentication
- Multi-factor authentication
- Role-based access control
- Audit logging
- Integration with external identity providers 