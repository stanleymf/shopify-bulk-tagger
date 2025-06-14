# Bulk-Tagger: Shopify Customer Tag Automation

A web application for automating customer tagging in Shopify stores based on customer segment membership. The app provides data persistence, real-time Shopify API integration, and a clean, intuitive interface for managing customer tags.

## Features

### 🔐 Data Persistence
- **Local Storage Integration**: All Shopify configuration, customer segments, and rules are automatically saved to browser localStorage
- **Session Recovery**: App state is preserved across browser sessions and page refreshes
- **Configuration Management**: Secure storage of API credentials with proper error handling
- **Automatic Sync**: Customer segments are cached locally and synced with Shopify on demand

### 🛍️ Shopify API Integration
- **Real-time Connection**: Direct integration with Shopify Admin API (2024-01)
- **Customer Segments**: Fetch and display all customer segments from your store
- **Tag Management**: Add/remove tags from customers based on segment membership
- **Batch Operations**: Efficient batch processing with rate limiting
- **Error Handling**: Comprehensive error handling for API failures and authentication issues

### 🎯 Core Functionality
- **Dashboard**: Overview of all customer segments with real-time statistics
- **Rules Engine**: Create automated tagging rules based on segment membership
- **Settings**: Secure configuration management for Shopify store connection
- **Authentication**: Basic authentication system for app access

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- A Shopify store with API access
- Shopify Private App credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Bulk-Tagger
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Open your browser to `http://localhost:5173`

### Shopify Setup

1. **Create a Private App**:
   - Go to your Shopify Admin → Apps → Manage private apps
   - Create a new private app
   - Enable the following API scopes:
     - `read_customers`
     - `write_customers`
     - `read_customer_segments`

2. **Get Your Credentials**:
   - Copy your API key, API secret, and access token
   - Note your shop domain (e.g., `your-store.myshopify.com`)

3. **Configure the App**:
   - Open the app and go to Settings
   - Enter your shop domain, API key, API secret, and access token
   - Click "Connect Store" to test the connection
   - Once connected, click "Sync Segments" to fetch your customer segments

## Usage

### Connecting Your Store
1. Navigate to the Settings page
2. Enter your Shopify store credentials
3. Click "Test Connection" to verify your credentials
4. Click "Connect Store" to establish the connection
5. Click "Sync Segments" to fetch your customer segments

### Managing Customer Segments
- View all customer segments on the Dashboard
- See real-time customer counts and segment details
- Sync segments manually or automatically
- Monitor last sync timestamps

### Creating Tagging Rules
- Navigate to the Rules page
- Create rules based on customer segment membership
- Define tag actions (add/remove tags)
- Activate/deactivate rules as needed

## Data Persistence Details

### Storage Structure
The app uses localStorage with the following structure:

```javascript
// Main app data
bulk_tagger_data: {
  segments: [], // Customer segments from Shopify
  rules: [],    // Tagging rules
  lastSync: "2024-01-15T10:30:00Z"
}

// Shopify configuration
bulk_tagger_shopify_config: {
  shopDomain: "your-store.myshopify.com",
  apiKey: "your-api-key",
  apiSecret: "your-api-secret", 
  accessToken: "your-access-token",
  isConnected: true,
  lastSync: "2024-01-15T10:30:00Z",
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T10:30:00Z"
}
```

### Persistence Features
- **Automatic Saving**: All changes are automatically saved to localStorage
- **Error Recovery**: Graceful handling of storage errors with fallbacks
- **Data Validation**: Input validation before saving to storage
- **Secure Storage**: Sensitive data is stored securely in browser storage

## API Integration

### Shopify API Endpoints Used
- `GET /admin/api/2024-01/shop.json` - Test connection
- `GET /admin/api/2024-01/customer_segments.json` - Fetch customer segments
- `GET /admin/api/2024-01/customer_segments/{id}/customers.json` - Get segment customers
- `PUT /admin/api/2024-01/customers/{id}.json` - Update customer tags
- `GET /admin/api/2024-01/customers/search.json` - Search customers

### Error Handling
- **Authentication Errors**: Automatic detection and user-friendly messages
- **Rate Limiting**: Built-in rate limiting with exponential backoff
- **Network Errors**: Comprehensive network error handling
- **API Errors**: Detailed error messages for different HTTP status codes

## Troubleshooting

### Connection Issues
1. **Invalid Credentials**: Verify your API key, secret, and access token
2. **CORS Errors**: Ensure your shop domain is correct and includes `.myshopify.com`
3. **Permission Errors**: Check that your private app has the required API scopes
4. **Network Issues**: Verify your internet connection and try again

### Data Sync Issues
1. **No Segments Found**: Ensure your store has customer segments created
2. **Sync Failures**: Check your API credentials and try reconnecting
3. **Stale Data**: Use the "Sync Segments" button to fetch fresh data

### Storage Issues
1. **Data Not Persisting**: Check if localStorage is enabled in your browser
2. **Storage Quota**: Clear browser data if you encounter storage quota errors
3. **Corrupted Data**: Use the "Disconnect Store" button to reset configuration

## Security Considerations

- **API Credentials**: Stored securely in browser localStorage
- **No Server Storage**: All data is stored locally in the browser
- **HTTPS Required**: App should be served over HTTPS in production
- **Credential Validation**: All API credentials are validated before use

## Development

### Project Structure
```
src/
├── components/          # React components
├── lib/                # Utility libraries
│   ├── storage.ts      # Data persistence
│   ├── shopify-api.ts  # Shopify API integration
│   └── config-context.tsx # Configuration context
├── data/               # Mock data and types
└── App.tsx            # Main application
```

### Key Technologies
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **localStorage** for data persistence
- **Shopify Admin API** for store integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🚀 Features

### Core Functionality
- **Customer Segment Synchronization**: Automatically sync customer segments from your Shopify store
- **Automated Tagging Rules**: Create rules that automatically add/remove tags when customers join/leave segments
- **Real-time Updates**: Monitor segment changes and apply rules automatically
- **Batch Operations**: Efficiently process large numbers of customers with rate limiting
- **Dry Run Mode**: Test rules without applying changes to your store
- **🔐 Basic Authentication**: Secure access control using HTTP Basic Authentication

### User Interface
- **Clean Dashboard**: Klaviyo-inspired design with clear segment overview
- **Rule Management**: Intuitive interface for creating and managing tagging rules
- **Real-time Status**: Monitor sync status and rule execution progress
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠 Technology Stack

- **Frontend**: React 18.3.1, TypeScript 5.8.2
- **Styling**: Tailwind CSS, shadcn/ui components
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers
- **API Integration**: Shopify Admin API (2024-01)
- **Authentication**: HTTP Basic Authentication

## 📋 Prerequisites

- Node.js 18+ and pnpm
- Shopify Partner account
- Shopify store with customer segments
- Cloudflare account (for deployment)

## 🔐 Authentication Setup

The application uses HTTP Basic Authentication to secure access. Configure your credentials:

### Environment Variables
```bash
USERNAME=admin                    # Username for basic auth
PASSWORD=your-secure-password     # Password for basic auth
REALM=Bulk-Tagger Admin          # Authentication realm (optional)
```

### Setting Up Secrets
```bash
# Set username and password as Cloudflare Workers secrets
wrangler secret put USERNAME
wrangler secret put PASSWORD
wrangler secret put REALM
```

For detailed authentication setup, see [Authentication Setup Guide](docs/AUTHENTICATION_SETUP.md).

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/stanleymf/shopify-bulk-tagger.git
cd shopify-bulk-tagger
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Authentication
Set up your authentication credentials as described above.

### 4. Development
```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

### 5. Build for Production
```bash
pnpm build
```

### 6. Deploy to Cloudflare Workers
```bash
pnpm deploy
```

## 🔧 Shopify Integration

### Required API Scopes
- `read_customers` - Access customer data
- `read_customer_segments` - Access segment information
- `write_customers` - Update customer tags

### Authentication Flow
1. User initiates Shopify store connection
2. Redirect to Shopify OAuth authorization
3. Store access token securely
4. Initialize API service with shop domain and token

### API Endpoints Used
- `GET /admin/api/2024-01/customer_segments.json` - Fetch segments
- `GET /admin/api/2024-01/customer_segments/{id}/customers.json` - Get segment customers
- `PUT /admin/api/2024-01/customers/{id}.json` - Update customer tags

## 📖 Usage Guide

### Setting Up Your First Rule

1. **Connect Your Store**
   - Click "Connect Store" in the dashboard
   - Authorize the app in Shopify
   - Wait for initial segment sync

2. **Create a Tagging Rule**
   - Navigate to the "Rules" section
   - Click "Create Rule"
   - Define trigger segment and actions
   - Save and activate the rule

3. **Monitor Execution**
   - View rule execution status
   - Check customer update counts
   - Review any errors or issues

### Rule Configuration

Rules follow this pattern:
```
WHEN a customer is a member of [Segment Name]
THEN [Add/Remove] tag [Tag Name]
```

**Example Rule:**
- **Trigger**: VIP Customers segment
- **Actions**: 
  - Add tag "VIP"
  - Remove tag "New Customer"

## 🏗 Architecture

### Core Services

#### Shopify API Service (`src/lib/shopify-api.ts`)
- Handles all Shopify API interactions
- Manages authentication and rate limiting
- Provides batch operations for efficiency

#### Rule Executor (`src/lib/rule-executor.ts`)
- Executes tagging rules against customer segments
- Manages background processing queue
- Handles error recovery and retry logic

#### Basic Authentication (`src/lib/basic-auth.ts`)
- HTTP Basic Authentication implementation
- Secure credential validation
- Session management and logout functionality

### Data Flow

1. **Authentication**: Basic auth validates user access
2. **Segment Sync**: Fetch segments from Shopify → Update local cache
3. **Rule Execution**: Get segment customers → Apply tag operations → Update customers
4. **Background Processing**: Queue rules → Process in batches → Handle errors

## 🔒 Security & Privacy

- **Basic Authentication**: HTTP Basic Auth for application access
- **OAuth 2.0**: Secure Shopify store authentication
- **Minimal Scopes**: Only request necessary API permissions
- **Rate Limiting**: Respect Shopify API limits
- **Data Privacy**: Only access customer data needed for tagging
- **Timing-Safe Comparison**: Prevent timing attacks in authentication

## 📊 Performance

- **Batch Processing**: Process up to 10 customers per API call
- **Rate Limiting**: 500ms delay between batches
- **Background Queue**: Non-blocking rule execution
- **Error Recovery**: Automatic retry with exponential backoff

## 🧪 Testing

### Development Testing
```bash
# Run type checking
pnpm check

# Run linting
pnpm lint

# Format code
pnpm format
```

### Authentication Testing
```bash
# Test without authentication (should return 401)
curl -i https://your-worker.your-subdomain.workers.dev/dashboard

# Test with authentication
curl -i -u admin:your-password https://your-worker.your-subdomain.workers.dev/dashboard

# Test logout
curl -i -u admin:your-password https://your-worker.your-subdomain.workers.dev/logout
```

### API Testing
- Use dry run mode to test rules without applying changes
- Monitor API response times and error rates
- Test with development Shopify store

## 📝 Documentation

- [Authentication Setup Guide](docs/AUTHENTICATION_SETUP.md) - Basic auth configuration
- [Shopify API Integration](docs/SHOPIFY_API_INTEGRATION.md) - API documentation
- [Contributing Guide](CONTRIBUTING.md) - Development guidelines

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in `docs/`
- Review the changelog for recent updates
- Open an issue for bugs or feature requests

## 🔄 Version History

See [CHANGELOG.md](CHANGELOG.md) for a complete version history.

---

**Built with ❤️ for Shopify store owners who want to automate their customer management.** 