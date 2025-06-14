# Changelog

All notable changes to the Bulk-Tagger project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Webhook integration for real-time segment updates
- Advanced filtering and search capabilities
- Analytics dashboard for tag operations
- Bulk rule import/export functionality

## [1.2.0] - 2024-01-15

### Added
- Dedicated login page with professional UI design
- Logout page with confirmation and success states
- Authentication context for state management across the app
- Persistent authentication state using localStorage
- Sign out button in sidebar navigation
- Improved user experience with loading states and error handling

### Features
- Clean, modern login form with validation
- Secure logout process with proper session cleanup
- Automatic authentication state restoration
- Responsive design for all screen sizes
- Professional branding and visual design

### Technical Details
- React Context API for authentication state management
- Local storage for persistent login state
- Proper error handling and user feedback
- Integration with existing basic authentication system
- TypeScript interfaces for type safety

## [1.1.1] - 2024-01-15

### Fixed
- Cloudflare Vite plugin compatibility issue resolved
- Updated compatibility date to "2024-09-23" in wrangler.jsonc
- Added nodejs_compat_v2 compatibility flag
- Development server now starts successfully on localhost:4321

### Technical Details
- Fixed Node.js compatibility mode error with Cloudflare Workers
- Updated wrangler configuration for latest Cloudflare Vite plugin requirements
- Development environment now fully functional

## [1.1.0] - 2024-01-15

### Added
- Basic authentication system using Cloudflare Workers
- Secure access control for the application
- Environment-based username and password configuration
- Timing-safe authentication comparison for security
- Logout functionality with proper session invalidation
- Authentication middleware for protected routes

### Security Enhancements
- HTTP Basic Authentication implementation
- Timing-safe string comparison using crypto.subtle.timingSafeEqual
- Secure password storage using Cloudflare Workers secrets
- Proper HTTP 401 responses with WWW-Authenticate headers
- Cache control headers to prevent credential caching

### Technical Details
- Cloudflare Workers basic auth integration
- Environment variable configuration for credentials
- Secure credential validation and session management
- Integration with existing Shopify OAuth flow

## [1.0.0] - 2024-01-15

### 🎉 First Major Release

### Added
- Complete Shopify API integration layer
- Customer segments synchronization with Shopify
- Customer tag management and batch operations
- Rule execution service for automated tagging
- Rate limiting and error handling for API calls
- Background processing queue for rule execution
- Dry run mode for testing rules without applying changes
- Tag parsing and manipulation utilities
- Rule validation system
- Comprehensive API documentation
- OAuth 2.0 authentication service
- Token management and persistence
- Clean, Klaviyo-inspired UI design
- Responsive dashboard with segment overview
- Rule management interface with CRUD operations
- Form validation and error handling

### Technical Details
- Shopify API service with OAuth 2.0 support
- Batch customer tag updates with rate limiting
- Customer segment membership tracking
- Rule execution with error handling and retry logic
- Background job processing for large operations
- Secure token storage and management
- React 18.3.1 with TypeScript 5.8.2
- Tailwind CSS for styling
- shadcn/ui component library
- Vite for build tooling
- Cloudflare Workers deployment setup

### Features
- View customer segments with counts and sync status
- Create, edit, and delete tagging rules
- Toggle rules active/inactive status
- Dynamic action management (add/remove tags)
- Automated customer tagging based on segment membership
- Real-time sync status monitoring
- Professional dashboard design

## [0.1.0] - 2024-01-15

### Added
- Initial UI prototype implementation
- Customer segments synchronization interface
- Tagging rules management system
- Rule creation and editing capabilities
- Mock data for development and testing

### Features
- View customer segments with counts and sync status
- Create, edit, and delete tagging rules
- Toggle rules active/inactive status
- Dynamic action management (add/remove tags)
- Clean, professional dashboard design

### Technical Details
- React 18.3.1 with TypeScript 5.8.2
- Tailwind CSS for styling
- shadcn/ui component library
- Vite for build tooling
- Cloudflare Workers deployment setup 