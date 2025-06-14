# Changelog

All notable changes to the Bulk-Tagger project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Webhook integration for real-time segment updates
- Analytics dashboard for tag operations
- Bulk rule import/export functionality

## [1.7.1] - 2024-12-19

### Fixed
- **CRITICAL BUG FIX**: GraphQL Customer ID Invalid Value Error
  - Fixed double GID prefix issue in GraphQL customer update mutations
  - Customer IDs from `getSegmentCustomerIds()` are already in GID format (`gid://shopify/Customer/123456`)
  - Removed duplicate `gid://shopify/Customer/` prefix that was causing "Variable $id of type ID! was provided invalid value" errors
  - Fixed in both `batchAddTags` and `batchRemoveTags` methods
  - Bulk tagging operations now work correctly with GraphQL API

### Technical Details
- Updated GraphQL query variables to use customer IDs directly instead of adding extra GID prefix
- Affects both customer tag queries and customer update mutations
- Resolves bulk tagging failures that were showing multiple "Failed to update customer" errors

## [1.7.0] - 2024-12-19

### Added
- **Complete Background Jobs System**: Full implementation of persistent background job management
  - Jobs now persist across browser sessions and page refreshes
  - Automatic job resumption when returning to the application
  - Real-time job progress tracking with skip counts
  - Background jobs UI with live progress bars and status indicators
  - Job history display showing recent completed/failed operations
  - Job cancellation and cleanup functionality
  - Comprehensive job metadata tracking (duration, results, errors)

### Enhanced
- **Background Jobs UI**: Rich visual interface for job management
  - Live progress bars with percentage completion
  - Skip count display in orange highlighting
  - Job duration tracking and display
  - Status indicators with color-coded job states
  - Recent jobs history with detailed results
  - Clear history functionality for completed jobs
  - Job cancellation controls with confirmation

### Technical Improvements
- **Job Persistence**: localStorage-based job storage with 10-job history limit
- **Job Lifecycle Management**: Complete status tracking (running, completed, failed, paused)
- **Automatic Resumption**: Detects and resumes interrupted jobs on page load
- **Progress Integration**: Skip tracking fully integrated with background job system
- **Error Handling**: Comprehensive error tracking and display in job results
- **Memory Management**: Automatic cleanup of old jobs and subscription management

### Fixed
- Job state synchronization between background service and UI components
- Progress callback integration with both old UI and new job system
- Job completion handling with proper success/error messaging
- Background job cancellation and cleanup processes

## [1.6.0] - 2024-12-28

### Added
- **Background Jobs Infrastructure**: Persistent bulk tagging operations that survive page refreshes
- **Job Persistence**: All bulk operations are now stored in localStorage and can resume after page reload
- **Background Jobs Service**: Comprehensive job management system with progress tracking
- **Job Status Tracking**: Monitor running, completed, failed, and paused jobs
- **Automatic Job Resumption**: Jobs automatically resume if interrupted by page refresh
- **Job History**: View recent job history with detailed status and results
- **Job Cancellation**: Ability to cancel running jobs
- **Stale Job Detection**: Automatically handle jobs that timeout after page reload

### Enhanced
- Bulk tagging operations now persist across browser sessions
- Real-time job progress tracking with persistent state
- Better error handling for interrupted operations
- Improved user experience with background job notifications

### Technical
- New `BackgroundJobsService` class for job management
- Persistent job storage using localStorage
- Job resumption logic with timeout detection
- Enhanced Dashboard component with job status display
- Background job state management and UI integration

## [1.5.1] - 2024-12-28

### Added
- **Skip Tracking**: Progress tracking now shows how many customers were skipped during bulk operations
- Enhanced progress display with skip count in orange text: "Progress: 1500/5000 (Skipped: 250)"
- Skip detection for customers who already have the tags being added or don't have the tags being removed
- Comprehensive skip tracking for both GraphQL and REST API methods
- Updated success messages to include skip counts: "Successfully tagged 4750 customers (Skipped: 250)"

### Enhanced
- Improved bulk tagging efficiency by skipping unnecessary operations
- Better user feedback showing exactly how many customers were processed vs skipped
- More accurate progress reporting with detailed skip reasons in status messages

### Technical
- Updated all progress callbacks to include `skipped` parameter: `(current, total, skipped, message) => void`
- Enhanced GraphQL batch methods to check existing tags before operations
- Improved REST API batch methods with skip detection logic
- Updated UI components to display skip counts in progress bars and completion messages

## [1.5.0] - 2024-12-28

### Added
- **Real-time Progress Tracking**: Live progress counters showing "1/5000...2/5000...3/5000" during bulk operations
- Visual animated progress bar with blue gradient and percentage display
- Detailed status messages for each operation phase
- Progress tracking for both GraphQL and REST API fallback methods
- Timeout prevention through regular progress callbacks
- Enhanced Dashboard component with dedicated progress display panel

### Enhanced
- Customer-by-customer progress updates with batch completion indicators
- Real-time UI updates during large bulk operations
- Improved user experience with visual feedback during long-running operations
- Better error handling and progress reporting

### Technical
- Added `onProgress` callbacks to all bulk tagging methods
- Implemented progress state management in Dashboard component
- Enhanced bulk operation methods with detailed progress reporting
- Added progress tracking for operations up to 30,000 customers

## [1.4.2] - 2024-12-28

### Enhanced
- **Massive Scale Support**: Increased customer limit from 10,000 to 30,000 per segment (3x increase)
- Optimized performance with 300ms delays for large operations
- Added progress updates every 10 pages for operations over 5,000 customers
- Enhanced logging with visual indicators and completion messages
- Updated monitoring system to support 30,000 customer snapshots

### Technical
- Increased `MAX_CUSTOMERS_PER_SEGMENT` to 30,000
- Optimized pagination with up to 120 pages (30,000 ÷ 250 per page)
- Enhanced progress reporting for large-scale operations
- Improved rate limiting for massive bulk operations

## [1.4.1] - 2024-12-28

### Fixed
- **Critical Bug**: Fixed 250 customer limit in bulk tagging operations
- Implemented cursor-based pagination to process all customers in large segments
- Added progress logging showing page completion (e.g., "Page 5/23 completed")
- Increased total customer limit from 250 to 10,000 per segment

### Enhanced
- Added 500ms delays between API calls for better rate limiting
- Improved error handling for large segment operations
- Better progress feedback during multi-page customer fetching

### Technical
- Implemented `getSegmentCustomerIds()` with cursor-based pagination
- Added `pageInfo` handling for GraphQL customer queries
- Enhanced bulk tagging methods to handle paginated customer lists

## [1.4.0] - 2024-12-28

### Added
- **Real-time Segment Monitoring**: Automated monitoring system that tracks customer movement between segments
- **Segment Monitoring Service**: Background service that takes snapshots and detects changes every 30 seconds
- **Automated Rule System**: Three trigger types for customer segment changes:
  - `segment_enter`: Customer joins a segment
  - `segment_exit`: Customer leaves a segment  
  - `segment_move`: Customer moves from one segment to another
- **Real-time Dashboard**: New "Real-time Monitoring" tab with live indicators and change history
- **Automated Tag Management**: Rules can automatically add/remove tags based on segment changes
- **Change History**: Persistent log of all customer segment movements with timestamps

### Enhanced
- Added monitoring controls: start/stop monitoring, clear history, export data
- Real-time status indicators showing active monitoring and last update times
- Comprehensive change detection with customer details and segment information
- Background processing with configurable monitoring intervals

### Technical
- New `SegmentMonitoringService` class with snapshot-based change detection
- Enhanced storage system for monitoring data persistence
- Added monitoring rules management with localStorage persistence
- Implemented real-time UI updates with live change indicators

## [1.3.9] - 2024-12-28

### Fixed
- **Query Translation Issue**: Fixed segment customer retrieval returning 0 customers despite segment showing customer count
- Implemented `translateSegmentQueryToCustomerSearch()` method to convert segment syntax to customer search syntax
- Added comprehensive regex-based translations for common segment query patterns

### Enhanced
- **Email Domain Translation**: `customer_email_domain = 'domain.com'` → `email:*@domain.com`
- **Tag Translation**: `customer_tags CONTAINS 'tag'` → `tag:tag`
- **Location Translation**: `customer_default_address_city = 'City'` → `city:City`
- **Date Translation**: `customer_created_date >= '2024-01-01'` → `created_at:>=2024-01-01`
- **State Translation**: `customer_account_state = 'enabled'` → `state:enabled`

### Technical
- Added robust query parsing with multiple translation patterns
- Improved error handling for unsupported query formats
- Enhanced customer search API integration with proper query formatting

## [1.3.8] - 2024-12-28

### Fixed
- **GraphQL Customer Field Error**: Resolved "Field 'customer' doesn't exist on type 'CustomerSegmentMember'" error
- Replaced direct CustomerSegmentMember.customer access with customer search API
- Updated `getSegmentCustomerIds()` to use `customers(query: String!)` instead of `customerSegmentMembers`

### Enhanced
- Added comprehensive error handling for GraphQL queries
- Improved customer retrieval with proper query-based search
- Better error messages for debugging customer access issues

### Technical
- Restructured GraphQL queries to use supported Shopify Admin API fields
- Added fallback mechanisms for customer data retrieval
- Enhanced error logging for GraphQL operations

## [1.3.7] - 2024-12-28

### Enhanced
- Improved error handling and user feedback
- Better connection status management
- Enhanced segment loading and caching

### Technical
- Optimized API calls and response handling
- Improved localStorage management
- Better error recovery mechanisms

## [1.3.6] - 2024-12-28

### Added
- Enhanced bulk tagging operations with better error handling
- Improved progress tracking during bulk operations
- Better user feedback for large segment operations

### Fixed
- Resolved issues with customer access in certain segment types
- Improved error messages for debugging

## [1.3.5] - 2024-12-28

### Enhanced
- Improved segment customer count loading
- Better caching mechanisms for segment data
- Enhanced UI responsiveness

## [1.3.4] - 2024-12-28

### Added
- Debug functionality for testing customer access
- Enhanced error reporting for segment operations
- Improved logging for troubleshooting

## [1.3.3] - 2024-12-28

### Enhanced
- Better segment data management
- Improved error handling for API operations
- Enhanced user interface feedback

## [1.3.2] - 2024-12-28

### Fixed
- Resolved segment loading issues
- Improved API error handling
- Better connection management

## [1.3.1] - 2024-12-28

### Enhanced
- Improved segment synchronization
- Better error messages
- Enhanced user experience

## [1.3.0] - 2024-12-28

### Added
- Customer segment management dashboard
- Bulk tag operations for customer segments
- Real-time segment customer counts
- Advanced segment filtering and search

### Enhanced
- Improved Shopify API integration
- Better error handling and user feedback
- Enhanced UI with modern design

### Technical
- GraphQL API integration for better performance
- Comprehensive error handling
- Optimized data fetching and caching

## [1.2.9] - 2025-06-14

### Fixed
- **CRITICAL**: Fixed segment query translation for customer search
- Added comprehensive query translation from segment syntax to customer search syntax
- Fixed email domain queries: `customer_email_domain = 'domain.com'` → `email:*@domain.com`
- Added support for email, tag, location, date, and state query translations
- Implemented fallback pattern extraction for untranslatable queries

### Added
- `translateSegmentQueryToCustomerSearch()` method for query syntax conversion
- Support for multiple segment query patterns and their customer search equivalents
- Enhanced logging for query translation debugging
- Fallback email domain extraction from complex queries

### Technical Changes
- Comprehensive regex-based query pattern matching and replacement
- Smart fallback handling for unsupported query patterns
- Improved customer search query building with proper syntax
- Enhanced error handling and debugging for query translation

## [1.2.8] - 2025-06-14

### Fixed
- **CRITICAL**: Fixed GraphQL error "Field 'customer' doesn't exist on type 'CustomerSegmentMember'"
- Replaced direct CustomerSegmentMember.customer access with customer search API
- Improved customer ID retrieval using segment query criteria
- Added fallback handling for segments without specific queries
- Enhanced error logging and debugging for customer access issues

### Technical Changes
- Modified `getSegmentCustomerIds()` to use customer search instead of segment member traversal
- Added segment query analysis and customer search query building
- Implemented safety limits for generic customer queries
- Improved GraphQL error handling and response validation

## [1.2.5] - 2025-01-15

### Added
- **GraphQL API support** as primary method for Shopify integration
- Dual API strategy: GraphQL (primary) + REST (fallback) for optimal performance
- GraphQL types and interfaces for customer segments and customers
- GraphQL queries for customer segments, segment customers, and tag updates
- Automatic fallback logic with detailed console logging
- Comprehensive GraphQL documentation and examples

### Features
- **Enhanced Performance**: GraphQL provides better performance for complex queries
- **Type Safety**: Strong typing for all GraphQL operations
- **Automatic Fallback**: Seamless switching between GraphQL and REST APIs
- **Better Error Handling**: Detailed error messages for both API types
- **Real-time Monitoring**: Console logging shows which API method is being used
- **Backward Compatibility**: Existing REST API implementation remains fully functional

### Technical Details
- GraphQL Admin API integration with proper authentication
- Automatic fallback to REST API when GraphQL fails
- Conversion utilities between GraphQL and REST data formats
- Enhanced error handling for both API types
- Performance optimization with reduced network calls
- Comprehensive documentation updates

### Changed
- Updated `getCustomerSegments()` to try GraphQL first, then REST
- Updated `getSegmentCustomers()` with GraphQL support
- Updated `updateCustomerTags()` with GraphQL mutations
- Enhanced Dashboard with API method indicators
- Updated documentation with dual API strategy

### Performance Improvements
- Reduced network overhead with GraphQL queries
- More efficient data fetching for complex operations
- Better caching strategies for frequently accessed data
- Optimized batch processing capabilities

### Fixed
- **CORS Issues**: Fixed CORS policy errors when accessing Shopify API from the browser
  - Added Cloudflare Workers proxy endpoint `/api/shopify/proxy` to handle all Shopify API requests
  - Updated all REST API methods in `shopify-api.ts` to use the proxy instead of direct calls
  - Updated GraphQL queries to use the proxy for consistent CORS handling
  - This resolves the "Access to fetch blocked by CORS policy" errors when fetching customer segments
- **Proxy Endpoint 404 Error**: Fixed 404 error on `/api/shopify/proxy` endpoint
  - Made the proxy endpoint public (no authentication required) so frontend can access it
  - Moved proxy handling from protected routes to public routes
  - Added proper route matching for proxy requests

### Changed
- **API Architecture**: All Shopify API calls now route through Cloudflare Workers proxy
  - `getCustomerSegmentsREST()` now uses proxy
  - `getSegmentCustomersREST()` now uses proxy  
  - `updateCustomerTagsREST()` now uses proxy
  - `testConnection()` now uses proxy
  - `graphqlQuery()` now uses proxy
  - `getCustomer()` now uses proxy
  - `searchCustomers()` now uses proxy

### Technical Details
- Added `handleShopifyProxy()` method to Cloudflare Worker
- Proxy handles all HTTP methods (GET, POST, PUT, DELETE)
- Proper CORS headers are added to all proxy responses
- Error handling and status code forwarding from Shopify API
- Maintains all existing functionality while fixing CORS issues
- Proxy endpoint is now accessible without authentication for frontend requests

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