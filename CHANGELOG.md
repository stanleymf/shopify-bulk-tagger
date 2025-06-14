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

## [1.2.4] - 2024-01-15

### Fixed
- **Critical data persistence issue** in Cloudflare Workers environment
- Configuration disappearing after page refresh
- localStorage availability and reliability problems

### Added
- Robust storage system with dual fallback mechanisms
- sessionStorage fallback when localStorage fails
- Comprehensive storage availability testing
- Debug storage button in Settings for troubleshooting
- Enhanced error handling and recovery mechanisms
- Detailed console logging for storage operations

### Changed
- Improved storage reliability for Cloudflare Workers deployment
- Enhanced configuration persistence across browser sessions
- Better error messages for storage failures
- More robust initialization of Shopify API service

### Technical Details
- Dual storage approach: localStorage + sessionStorage fallback
- Storage availability testing on app initialization
- Comprehensive debugging tools for troubleshooting
- Enhanced error handling with graceful degradation
- Improved logging throughout config context and storage system

### Features
- Configuration now persists reliably after page refresh
- Debug tools to identify storage issues
- Fallback mechanisms ensure data persistence
- Better user experience with persistent settings

## [1.2.3] - 2024-01-15

### Added
- Custom favicon with tag icon design
- Professional browser tab title
- Meta description for SEO

### Changed
- Updated browser tab title from "React Starter" to "Bulk Tagger - Shopify Customer Tagging Automation"
- Replaced default Vite favicon with custom tag-themed favicon
- Enhanced brand identity with consistent blue color scheme

### Features
- Professional favicon design with tag icon and app branding
- Descriptive browser tab title for better user experience
- SEO-friendly meta description
- Consistent visual identity across browser tabs

### Technical Details
- Custom SVG favicon with scalable design
- Updated HTML head section with proper meta tags
- Brand-consistent color scheme (#2563eb blue)
- Responsive favicon that works across all devices

## [1.2.2] - 2024-01-15

### Added
- Settings module in sidebar navigation
- Shopify authentication configuration form
- Connection status monitoring and testing
- Secure credential input with show/hide toggle
- Manual segment synchronization controls
- Professional settings interface with validation

### Features
- Complete Shopify store configuration interface
- Real-time connection status display
- Test connection functionality
- Manual sync triggers for customer segments
- Secure credential management with password fields
- Helpful guidance and documentation links

### Technical Details
- New Settings component with comprehensive form
- Connection status card with live updates
- Form validation for required fields
- Loading states for all async operations
- Error and success message handling
- Responsive design for all screen sizes

## [1.2.1] - 2024-01-15

### Changed
- Removed all mock/static data from the application
- Added proper empty states for segments and rules
- Enhanced user experience with clear messaging when no data is available

### Added
- Empty state components for Dashboard and Rules pages
- Call-to-action buttons for connecting Shopify store
- Warning messages when trying to create rules without segments
- Improved visual feedback for empty data scenarios

### Features
- Clean slate application ready for real Shopify integration
- Professional empty states with helpful guidance
- Clear user flow for initial setup and data population
- Better UX for first-time users

### Technical Details
- Cleared mockSegments and mockRules arrays
- Added conditional rendering for empty states
- Enhanced form validation for empty segment lists
- Maintained TypeScript interfaces for type safety

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