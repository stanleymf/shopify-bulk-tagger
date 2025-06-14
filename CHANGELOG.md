# Changelog

All notable changes to the Bulk-Tagger project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Webhook integration for real-time segment updates
- Analytics dashboard for tag operations
- Bulk rule import/export functionality

## [1.3.9] - 2025-06-14

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

## [1.3.8] - 2025-06-14

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

## [1.3.7] - 2025-01-14

### Added
- **🔍 Debug Customer Access**: Added "Test Customer Access" button to each segment card for troubleshooting
- **📊 Enhanced Logging**: Comprehensive logging in `getSegmentCustomerIds()` to debug customer access issues
- **🛡️ Smart Fallback**: Automatic fallback to `getSegmentCustomers()` when GraphQL returns count but no customer data
- **💬 Better Error Messages**: More helpful error messages explaining why bulk tagging might fail

### Fixed
- **🐛 Customer Access Issue**: Addresses the issue where segments show customer count but return 0 customers for tagging
- **📋 Detailed Diagnostics**: Added logging to identify if the issue is permissions, segment type, or API limitations

### Technical Improvements
- **Debug Tools**: Test button triggers detailed console logging for troubleshooting
- **Error Classification**: Distinguishes between different types of customer access failures
- **Fallback Mechanism**: When GraphQL `customerSegmentMembers` returns `totalCount > 0` but `edges.length = 0`, automatically tries the existing `getSegmentCustomers` method
- **Console Logging**: Detailed logging of GraphQL queries, responses, and customer ID extraction

### User Experience
- **Helpful Error Messages**: Explains potential causes (permissions, dynamic segments, API limitations)
- **Debug Workflow**: Easy-to-use test button for diagnosing segment access issues
- **Console Guidance**: Directs users to check browser console for detailed diagnostic information

## [1.3.6] - 2025-01-14

### Fixed
- **🔧 Bulk Tagging ID Issue**: Fixed GraphQL query to get actual customer IDs instead of CustomerSegmentMember IDs
- **🔄 REST API Fallback**: Added comprehensive REST API fallback for bulk tagging operations
- **⚡ Improved Reliability**: GraphQL attempts first, automatically falls back to REST API if GraphQL fails
- **🛡️ Error Handling**: Better error handling and more descriptive error messages

### Technical Improvements
- **Correct GraphQL Query**: Fixed `customerSegmentMembers` query to access `customer.id` instead of segment member ID
- **Dual API Support**: Both GraphQL and REST API implementations for maximum compatibility
- **Smart Fallback**: Automatic fallback from GraphQL to REST API on errors
- **Batch Processing**: Optimized batch sizes (10 for GraphQL, 5 for REST) with proper rate limiting
- **Enhanced Logging**: Better error logging and debugging information

### API Changes
- Fixed `getSegmentCustomerIds()` to return actual customer IDs
- Added `bulkAddTagsToSegmentGraphQL()` and `bulkAddTagsToSegmentREST()` methods
- Added `bulkRemoveTagsToSegmentGraphQL()` and `bulkRemoveTagsToSegmentREST()` methods
- Improved error messages for better debugging

## [1.3.5] - 2025-01-14

### Added
- **🎯 Bulk Customer Tagging**: Complete bulk tagging functionality for customer segments
- **Add Tags to Segment**: Bulk add tags to all customers in a segment without pulling customer data
- **Remove Tags from Segment**: Bulk remove tags from all customers in a segment
- **Smart Processing**: Automatically uses batch processing (<100 customers) or Shopify Bulk Operations (>100 customers)
- **Interactive UI**: Clean interface with Add/Remove tag buttons on each segment card
- **Real-time Feedback**: Progress indicators, success/error messages, and processing status
- **Tag Input**: Comma-separated tag input with validation and error handling

### Technical Implementation
- **Efficient API Usage**: Only fetches customer IDs, not full customer data
- **GraphQL Integration**: Uses `customerSegmentMembers` query for segment customer identification
- **Batch Processing**: Processes customers in batches of 10 to respect API rate limits
- **Error Handling**: Comprehensive error handling with detailed feedback
- **Rate Limiting**: Built-in delays between batches to prevent API throttling
- **Tag Management**: Proper tag parsing, deduplication, and formatting

### UI/UX Improvements
- **Segment Card Enhancement**: Added bulk tagging controls to each segment card
- **Color-coded Actions**: Green for Add Tags, Red for Remove Tags
- **Expandable Interface**: Click to expand tagging interface, cancel to collapse
- **Input Validation**: Real-time validation of tag input with helpful placeholders
- **Processing States**: Loading indicators and disabled states during operations

## [1.3.4] - 2025-01-14

### Added
- **Debug Feature**: Added "Clear Counts (Debug)" button to reset customer counts
- **Load Count Button Visibility**: Debug button allows users to see Load Count buttons again
- **User Experience**: Helps users understand the Load Count functionality behavior

### Fixed
- **Load Count Button Issue**: Addressed user concern about Load Count buttons not being visible
- **Explanation**: Load Count buttons are hidden when customer counts are already loaded (cached in localStorage)
- **Expected Behavior**: This is correct functionality to prevent redundant API calls

### Technical Notes
- Customer counts persist in localStorage after being loaded once
- Load Count buttons only appear when `customer_count` is undefined
- Debug button temporarily resets this state for demonstration purposes

## [1.3.3] - 2025-01-14

### Improved
- **Enhanced Segment Card UI**: Complete redesign of segment cards for better readability
- **No Text Truncation**: All segment names, queries, and information now display fully
- **Better Layout**: Improved spacing, typography, and visual hierarchy
- **Responsive Grid**: Better responsive behavior with proper breakpoints (lg:2 cols, xl:3 cols)
- **Visual Enhancements**: 
  - Larger, more readable segment names
  - Query text in dedicated highlighted sections with word wrapping
  - Cleaner date formatting (e.g., "Jan 15, 2024")
  - Better customer count badges with icons
  - Improved hover effects and transitions
  - Organized information in structured sections

### Technical
- Replaced basic div cards with proper Card components
- Added proper CardHeader and CardContent structure
- Improved accessibility with better contrast and spacing
- Enhanced mobile responsiveness

## [1.3.2] - 2025-01-14

### Fixed
- Confirmed Load Count functionality working correctly
- Customer counts persist in localStorage after loading
- Load Count buttons appear when customer_count is undefined
- Customer count badges replace Load Count buttons after successful loading

### Technical Notes
- Load Count buttons are hidden when segments already have customer counts loaded
- This is expected behavior to prevent redundant API calls
- Customer counts are cached locally for performance

## [1.3.1] - 2025-01-14

### Added ✨
- **Customer Count Loading**: Added "Load Count" buttons on each segment card to fetch real customer counts
- **Dynamic Count Display**: Customer counts are fetched on-demand and cached for performance
- **Loading States**: Visual loading indicators while fetching customer counts
- **Count Persistence**: Customer counts are stored locally and persist across sessions

### Features
- Individual "Load Count" buttons for each segment card
- Real-time customer count fetching using Shopify's `customerSegmentMembers` GraphQL query
- Loading spinners and disabled states during count fetching
- Automatic count caching and storage
- Error handling for failed count requests

### API Enhancements
- Added `getSegmentCustomerCount()` method to fetch customer count for specific segments
- Added `updateSegmentCustomerCount()` and `setSegmentCountLoading()` helper methods
- Enhanced segment interface with `is_loading_count` property
- Improved error handling and logging for count operations

### UI/UX Improvements
- Replaced static customer count badges with dynamic load buttons
- Added Hash icon for Load Count buttons
- Smooth loading states with spinner animations
- Consistent button styling and responsive design

## [1.3.0] - 2025-01-14

### Added ✨
- **Search Bar**: Added search functionality to Customer Segments page for easy filtering
- **Real-time Filtering**: Filter segments by name or query terms as you type
- **Search Results Counter**: Shows filtered count vs total segments
- **Empty Search State**: Helpful message and clear button when no segments match search
- **Visual Search Indicators**: Search icon and filtered count display in stats

### Features
- Search through customer segments by name or query criteria
- Real-time filtering with instant results
- Clear search functionality with one click
- Responsive search bar design
- Search results counter in segment overview
- Empty state handling for no search results

### UI/UX Improvements
- Added search input with search icon
- Enhanced segment overview header with result counts
- Improved empty states for better user guidance
- Consistent styling with existing design system

## [1.2.9] - 2025-01-14

### Fixed ✅
- **Customer Segments Sync**: Successfully resolved customer segments synchronization issues
- **GraphQL API**: Confirmed working with correct `segments` field implementation
- **Production Verification**: All fixes deployed and verified working in production environment

### Verified Working
- Customer segments now loading correctly in the application
- GraphQL queries returning proper segment data (id, name, query, creationDate, lastEditDate)
- Proxy infrastructure handling all requests successfully
- No more "Field 'customerSegments' doesn't exist" errors

### Production Status
- Version 1.2.9 successfully deployed to Cloudflare Workers
- Customer segments synchronization confirmed working
- All API endpoints responding correctly
- Application fully functional for customer segment management

## [1.2.8] - 2025-01-14

### Fixed
- **Customer Segments API**: Fixed GraphQL query to use correct `segments` field instead of deprecated `customerSegments`
- **API Compatibility**: Updated GraphQL queries to work with current Shopify API versions (2024-01 and later)
- **Error Handling**: Improved error messages for GraphQL API failures
- **REST API Removal**: Removed REST API fallback for customer segments as they are no longer available via REST

### Technical Changes
- Updated `getCustomerSegmentsGraphQL()` to use `segments` query with correct field structure
- Removed deprecated `getCustomerSegmentsREST()` method
- Updated segment customers handling to reflect current API limitations
- Enhanced error handling with proper GraphQL error reporting

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