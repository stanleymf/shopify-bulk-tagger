# Storage Migration Guide: localStorage to Server-Side Storage

This guide explains how to migrate the Bulk-Tagger application from client-side localStorage to server-side storage using Cloudflare D1 database.

## Overview

**Current State:** All data is stored in the browser's localStorage
**Target State:** All data is stored server-side in a Cloudflare D1 SQLite database with API endpoints

## What's Being Migrated

### 1. **Shopify Configuration**
- Shop domain, access tokens, connection status
- Currently: `localStorage['bulk_tagger_shopify_config']`
- Target: `shopify_configs` table with user isolation

### 2. **Customer Segments**
- Segment data, customer counts, sync status
- Currently: `localStorage['bulk_tagger_data'].segments`
- Target: `customer_segments` table with user isolation

### 3. **Background Jobs**
- Job progress, status, history (pause/resume/cancel)
- Currently: `localStorage['bulk_tagger_background_jobs']`
- Target: `background_jobs` table with full state management

### 4. **Authentication State**
- Login status, session management
- Currently: `localStorage['bulk_tagger_auth']`
- Target: Server-side session management with database user table

### 5. **Tagging Rules**
- Automated tagging rules and configurations
- Currently: `localStorage['bulk_tagger_data'].rules`
- Target: `tagging_rules` table with user isolation

### 6. **Application Settings**
- Monitoring settings, preferences
- Currently: Various localStorage keys
- Target: `app_settings` table with key-value storage

## Implementation Steps

### Step 1: Set Up D1 Database

1. **Create D1 Database:**
```bash
npx wrangler d1 create bulk-tagger-db
```

2. **Update wrangler.jsonc with database ID:**
```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "bulk-tagger-db",
      "database_id": "your-actual-database-id"
    }
  ]
}
```

3. **Initialize Database Schema:**
```bash
npx wrangler d1 execute bulk-tagger-db --file=worker/schema.sql
```

### Step 2: Deploy Updated Worker

1. **Deploy with D1 binding:**
```bash
npx wrangler deploy
```

2. **Verify API endpoints:**
- `GET /api/shopify/config` - Shopify configuration
- `GET /api/segments` - Customer segments
- `GET /api/background-jobs` - Background jobs
- `GET /api/rules` - Tagging rules
- `GET /api/settings/{key}` - Application settings

### Step 3: Update Client-Side Code

1. **Replace storage imports:**
```typescript
// Old
import { storage } from './storage';

// New
import { serverStorage } from './server-storage';
```

2. **Update service layer:**
```typescript
// Old synchronous localStorage
const config = storage.getShopifyConfig();

// New asynchronous server storage
const config = await serverStorage.getShopifyConfig();
```

### Step 4: Migration Process

The migration happens in phases:

#### Phase 1: Dual Storage (Backward Compatibility)
- Both localStorage and server storage work simultaneously
- Writes go to both systems
- Reads prefer server storage with localStorage fallback

#### Phase 2: Server-Only Storage
- All operations use server storage exclusively
- localStorage is cleared and disabled

## Code Changes Required

### 1. **ShopifyAPIService Updates**

```typescript
// src/lib/shopify-api.ts
export class ShopifyAPIService {
  private async initializeFromStorage(): Promise<void> {
    try {
      // Replace localStorage with server storage
      const config = await serverStorage.getShopifyConfig();
      if (config && config.isConnected) {
        this.initialize(config.shopDomain, config.accessToken);
      }
    } catch (error) {
      console.error('Failed to initialize from server storage:', error);
    }
  }

  async getStoredSegments(): Promise<ShopifyCustomerSegment[]> {
    return await serverStorage.getSegments();
  }
}
```

### 2. **BackgroundJobsService Updates**

```typescript
// src/lib/background-jobs.ts
export class BackgroundJobsService {
  private async loadJobsFromStorage(): Promise<void> {
    try {
      const jobs = await serverStorage.getBackgroundJobs();
      // Process server-side jobs
    } catch (error) {
      console.error('Failed to load jobs from server:', error);
    }
  }

  private async saveJobsToStorage(): Promise<void> {
    // Save to server instead of localStorage
    await serverStorage.updateBackgroundJob(jobId, jobData);
  }
}
```

### 3. **Component Updates**

All components that use storage need to be updated:

```typescript
// Before
const segments = storage.getSegments();

// After
const [segments, setSegments] = useState([]);
useEffect(() => {
  const loadSegments = async () => {
    const data = await serverStorage.getSegments();
    setSegments(data);
  };
  loadSegments();
}, []);
```

## Benefits of Server-Side Storage

### 1. **Data Persistence**
- ✅ Data survives browser cache clearing
- ✅ Data survives browser reinstalls
- ✅ Access from multiple devices
- ✅ No storage quota limitations

### 2. **Performance**
- ✅ Faster initial page loads (no localStorage parsing)
- ✅ Background data synchronization
- ✅ Reduced client-side memory usage
- ✅ Better handling of large datasets

### 3. **Reliability**
- ✅ Database transactions and consistency
- ✅ Backup and recovery capabilities
- ✅ Concurrent access handling
- ✅ Data integrity constraints

### 4. **Security**
- ✅ Server-side authentication and authorization
- ✅ User data isolation
- ✅ Secure credential storage
- ✅ Audit trails and logging

### 5. **Features**
- ✅ Multi-user support
- ✅ Real-time collaboration potential
- ✅ Advanced querying capabilities
- ✅ Data analytics and reporting

## Database Schema Highlights

```sql
-- User isolation for all data
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT
);

-- Shopify configurations per user
CREATE TABLE shopify_configs (
    user_id INTEGER,
    shop_domain TEXT,
    access_token TEXT,
    is_connected BOOLEAN,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Background jobs with full state management
CREATE TABLE background_jobs (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    status TEXT CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
    progress_current INTEGER,
    progress_total INTEGER,
    -- ... other fields
);
```

## Testing Strategy

### 1. **Development Testing**
- Test with local D1 database using `wrangler dev`
- Verify all API endpoints work correctly
- Test data migration from localStorage

### 2. **Production Testing**
- Deploy to staging environment first
- Test with real Shopify data
- Verify background job persistence
- Test pause/resume functionality across page refreshes

### 3. **Migration Testing**
- Test data export from localStorage
- Test data import to server storage
- Verify data integrity and completeness
- Test rollback procedures

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback:**
   - Revert to previous version without server storage
   - localStorage remains intact

2. **Data Recovery:**
   - Export data from D1 database
   - Restore to localStorage format
   - Verify application functionality

3. **Gradual Migration:**
   - Implement hybrid approach
   - Gradually migrate user by user
   - Monitor for issues before full rollout

## Deployment Checklist

- [ ] D1 database created and configured
- [ ] Database schema deployed
- [ ] Worker updated with database bindings
- [ ] API endpoints tested and working
- [ ] Client-side code updated for async storage
- [ ] Authentication system updated
- [ ] Background jobs system updated
- [ ] Migration scripts tested
- [ ] Backup procedures in place
- [ ] Rollback plan prepared
- [ ] Documentation updated
- [ ] Team trained on new system

## Post-Migration Benefits

After migration, the application will have:

1. **Enterprise-grade data persistence**
2. **Multi-user capability** (foundation for future features)
3. **Better performance** and reliability
4. **Enhanced security** with proper user isolation
5. **Scalability** for large datasets
6. **Professional deployment** architecture

This migration transforms Bulk-Tagger from a client-side tool to a proper web application with enterprise-grade data management capabilities. 