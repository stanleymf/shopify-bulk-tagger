-- Database schema for Bulk-Tagger server-side storage
-- Replaces localStorage with persistent server-side data

-- User sessions and authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shopify store configurations
CREATE TABLE IF NOT EXISTS shopify_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shop_domain TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    access_token TEXT NOT NULL,
    is_connected BOOLEAN DEFAULT FALSE,
    last_sync DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, shop_domain)
);

-- Customer segments cache
CREATE TABLE IF NOT EXISTS customer_segments (
    id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    query TEXT,
    customer_count INTEGER DEFAULT 0,
    is_loading_count BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, user_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Background jobs for bulk operations
CREATE TABLE IF NOT EXISTS background_jobs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bulk_add_tags', 'bulk_remove_tags')),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
    segment_id INTEGER NOT NULL,
    segment_name TEXT NOT NULL,
    tags TEXT NOT NULL, -- JSON array as string
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    progress_skipped INTEGER DEFAULT 0,
    progress_message TEXT DEFAULT 'Initializing...',
    result_success BOOLEAN,
    result_processed_count INTEGER,
    result_skipped_count INTEGER,
    result_errors TEXT, -- JSON array as string
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_cancelled BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);



-- Monitoring data for real-time segment tracking
CREATE TABLE IF NOT EXISTS segment_monitoring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    segment_id INTEGER NOT NULL,
    segment_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('enter', 'exit', 'move')),
    previous_segment_id INTEGER,
    previous_segment_name TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- App settings and metadata
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT, -- JSON as string for complex values
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, setting_key)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopify_configs_user_id ON shopify_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_user_id ON customer_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_last_synced ON customer_segments(last_synced);
CREATE INDEX IF NOT EXISTS idx_background_jobs_user_id ON background_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_start_time ON background_jobs(start_time);

CREATE INDEX IF NOT EXISTS idx_segment_monitoring_user_id ON segment_monitoring(user_id);
CREATE INDEX IF NOT EXISTS idx_segment_monitoring_processed ON segment_monitoring(processed);
CREATE INDEX IF NOT EXISTS idx_app_settings_user_key ON app_settings(user_id, setting_key); 