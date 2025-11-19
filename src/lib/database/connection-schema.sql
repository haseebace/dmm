-- Connection Status Management Schema
-- Schema for tracking Real-Debrid connection status, health checks, and events
-- Created for Story 2.4: Connection Status Management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connection status tracking table
CREATE TABLE IF NOT EXISTS connection_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Individual status components
  authentication_state TEXT NOT NULL CHECK (authentication_state IN (
    'unauthenticated', 'authenticated', 'token_expired', 'error'
  )),
  service_state TEXT NOT NULL CHECK (service_state IN (
    'available', 'degraded', 'unavailable', 'rate_limited'
  )),
  network_state TEXT NOT NULL CHECK (network_state IN (
    'connected', 'disconnected', 'poor_connection'
  )),
  overall_status TEXT NOT NULL CHECK (overall_status IN (
    'connected', 'connecting', 'disconnected', 'error', 'limited', 'reconnecting'
  )),

  -- Status metadata
  user_id_rd TEXT, -- Real-Debrid user ID
  username TEXT, -- Real-Debrid username
  last_health_check TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  consecutive_errors INTEGER NOT NULL DEFAULT 0,

  -- Performance metrics
  response_time INTEGER DEFAULT 0, -- API response time in milliseconds
  error_rate DECIMAL(5,2) DEFAULT 100.00, -- Error rate percentage
  network_latency INTEGER DEFAULT 0, -- Network latency in milliseconds

  -- Status details
  status_code INTEGER, -- Last HTTP status code
  error_message TEXT, -- Last error message
  properties JSONB DEFAULT '{}', -- Additional status properties

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one status record per user
  UNIQUE(user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_connection_status_user_id ON connection_status(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_status_overall_status ON connection_status(overall_status);
CREATE INDEX IF NOT EXISTS idx_connection_status_updated_at ON connection_status(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_status_authentication_state ON connection_status(authentication_state);

-- Health check results table
CREATE TABLE IF NOT EXISTS health_check_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Health check details
  check_name TEXT NOT NULL CHECK (check_name IN (
    'realdebrid-api', 'network-connectivity', 'authentication'
  )),
  success BOOLEAN NOT NULL,

  -- Performance metrics
  response_time INTEGER NOT NULL, -- Response time in milliseconds
  status_code INTEGER, -- HTTP status code if applicable

  -- Error information
  error_message TEXT,
  error_details JSONB DEFAULT '{}', -- Structured error information

  -- Check result details
  check_details JSONB DEFAULT '{}', -- Additional check-specific data

  -- Timing
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Indexes
  INDEX idx_health_check_results_user_id (user_id),
  INDEX idx_health_check_results_check_name (check_name),
  INDEX idx_health_check_results_success (success),
  INDEX idx_health_check_results_checked_at (checked_at DESC),
  INDEX idx_health_check_results_user_check_time (user_id, check_name, checked_at DESC)
);

-- Connection events table for audit trail and analytics
CREATE TABLE IF NOT EXISTS connection_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- e.g., 'status_change', 'reconnection_attempt', 'health_check_failure'
  previous_state TEXT, -- Previous connection state
  new_state TEXT, -- New connection state

  -- Event data
  event_data JSONB DEFAULT '{}', -- Structured event data

  -- Event categorization
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  category TEXT NOT NULL DEFAULT 'general', -- e.g., 'authentication', 'network', 'service'

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_connection_events_user_id (user_id),
  INDEX idx_connection_events_event_type (event_type),
  INDEX idx_connection_events_severity (severity),
  INDEX idx_connection_events_category (category),
  INDEX idx_connection_events_created_at (created_at DESC),
  INDEX idx_connection_events_user_time (user_id, created_at DESC)
);

-- Connection notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS connection_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'success', 'warning', 'error', 'info'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Notification metadata
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  method TEXT NOT NULL CHECK (method IN ('in_app', 'browser', 'email')),

  -- Notification state
  dismissed BOOLEAN DEFAULT FALSE,
  acknowledged BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Notification actions
  actions JSONB DEFAULT '[]', -- Available actions for this notification

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- When notification should be auto-removed

  -- Indexes
  INDEX idx_connection_notifications_user_id (user_id),
  INDEX idx_connection_notifications_type (notification_type),
  INDEX idx_connection_notifications_severity (severity),
  INDEX idx_connection_notifications_dismissed (dismissed),
  INDEX idx_connection_notifications_acknowledged (acknowledged),
  INDEX idx_connection_notifications_created_at (created_at DESC),
  INDEX idx_connection_notifications_expires_at (expires_at) WHERE expires_at IS NOT NULL
);

-- Connection diagnostics table for storing diagnostic snapshots
CREATE TABLE IF NOT EXISTS connection_diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Diagnostic snapshot
  diagnostics JSONB NOT NULL, -- Complete diagnostic information

  -- Diagnostic context
  trigger_reason TEXT, -- e.g., 'manual', 'error_threshold', 'periodic'
  connection_status TEXT, -- Overall status at time of diagnostic

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_connection_diagnostics_user_id (user_id),
  INDEX idx_connection_diagnostics_trigger_reason (trigger_reason),
  INDEX idx_connection_diagnostics_created_at (created_at DESC)
);

-- User connection preferences table
CREATE TABLE IF NOT EXISTS connection_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Health check preferences
  health_check_interval INTEGER NOT NULL DEFAULT 30000, -- milliseconds
  enable_auto_reconnect BOOLEAN NOT NULL DEFAULT TRUE,
  max_reconnect_attempts INTEGER NOT NULL DEFAULT 10,

  -- Notification preferences
  enable_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  notification_methods TEXT[] NOT NULL DEFAULT ARRAY['in_app', 'browser'],
  throttle_notifications BOOLEAN NOT NULL DEFAULT TRUE,

  -- Advanced preferences
  enable_diagnostics BOOLEAN NOT NULL DEFAULT FALSE,
  debug_mode BOOLEAN NOT NULL DEFAULT FALSE,

  -- Additional preferences
  custom_settings JSONB DEFAULT '{}',

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Monitoring configuration table
CREATE TABLE IF NOT EXISTS monitoring_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Configuration scope
  scope TEXT NOT NULL CHECK (scope IN ('global', 'user_type', 'individual')),
  scope_id TEXT, -- User ID or user type identifier

  -- Health check configuration
  api_interval INTEGER NOT NULL DEFAULT 30000,
  network_interval INTEGER NOT NULL DEFAULT 60000,
  timeout INTEGER NOT NULL DEFAULT 10000,
  max_retries INTEGER NOT NULL DEFAULT 3,

  -- Reconnection configuration
  reconnection_max_attempts INTEGER NOT NULL DEFAULT 10,
  reconnection_base_delay INTEGER NOT NULL DEFAULT 1000,
  reconnection_max_delay INTEGER NOT NULL DEFAULT 60000,
  reconnection_backoff_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0,
  reconnection_jitter BOOLEAN NOT NULL DEFAULT TRUE,

  -- Notification configuration
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notifications_types TEXT[] NOT NULL DEFAULT ARRAY[
    'connection_lost', 'connection_restored', 'service_unavailable',
    'authentication_error', 'rate_limit_exceeded'
  ],
  notifications_methods TEXT[] NOT NULL DEFAULT ARRAY['in_app', 'browser'],
  notifications_throttle INTEGER NOT NULL DEFAULT 30000,

  -- Persistence configuration
  persistence_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  persistence_storage_type TEXT NOT NULL DEFAULT 'localStorage',
  persistence_encrypt BOOLEAN NOT NULL DEFAULT FALSE,

  -- Configuration metadata
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100, -- Higher priority overrides lower

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one active config per scope
  UNIQUE(scope, scope_id) WHERE is_active = TRUE
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_connection_status_updated_at ON connection_status;
CREATE TRIGGER update_connection_status_updated_at
  BEFORE UPDATE ON connection_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_connection_preferences_updated_at ON connection_preferences;
CREATE TRIGGER update_connection_preferences_updated_at
  BEFORE UPDATE ON connection_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monitoring_config_updated_at ON monitoring_config;
CREATE TRIGGER update_monitoring_config_updated_at
  BEFORE UPDATE ON monitoring_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE connection_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for connection_status
CREATE POLICY "Users can view own connection status" ON connection_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own connection status" ON connection_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connection status" ON connection_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connection status" ON connection_status
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for health_check_results
CREATE POLICY "Users can view own health check results" ON health_check_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health check results" ON health_check_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health check results" ON health_check_results
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for connection_events
CREATE POLICY "Users can view own connection events" ON connection_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connection events" ON connection_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for connection_notifications
CREATE POLICY "Users can view own notifications" ON connection_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON connection_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON connection_notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON connection_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for connection_diagnostics
CREATE POLICY "Users can view own diagnostics" ON connection_diagnostics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnostics" ON connection_diagnostics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagnostics" ON connection_diagnostics
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for connection_preferences
CREATE POLICY "Users can view own preferences" ON connection_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON connection_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON connection_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for monitoring_config (more restrictive)
CREATE POLICY "Users can view global monitoring config" ON monitoring_config
  FOR SELECT USING (scope = 'global');

CREATE POLICY "Service role can manage monitoring config" ON monitoring_config
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Views for common queries
CREATE OR REPLACE VIEW user_connection_summary AS
SELECT
  cs.user_id,
  cs.overall_status,
  cs.authentication_state,
  cs.service_state,
  cs.network_state,
  cs.response_time,
  cs.error_rate,
  cs.last_health_check,
  cs.consecutive_errors,
  cs.updated_at,
  -- Latest health check results
  (SELECT json_agg(
    json_build_object(
      'name', check_name,
      'success', success,
      'response_time', response_time,
      'checked_at', checked_at
    ) ORDER BY checked_at DESC
  ) FROM (
    SELECT DISTINCT ON (check_name)
      check_name, success, response_time, checked_at
    FROM health_check_results
    WHERE user_id = cs.user_id
    ORDER BY check_name, checked_at DESC
  ) latest_checks) as latest_health_checks,
  -- Unread notifications count
  (SELECT COUNT(*) FROM connection_notifications
   WHERE user_id = cs.user_id AND dismissed = FALSE AND acknowledged = FALSE) as unread_notifications
FROM connection_status cs;

-- Function to clean up old health check results
CREATE OR REPLACE FUNCTION cleanup_old_health_check_results()
RETURNS void AS $$
BEGIN
  -- Delete health check results older than 7 days
  DELETE FROM health_check_results
  WHERE checked_at < NOW() - INTERVAL '7 days';

  -- Keep only last 100 results per user per check type
  DELETE FROM health_check_results
  WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, check_name) id
    FROM health_check_results
    ORDER BY user_id, check_name, checked_at DESC
    LIMIT 100
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Delete expired notifications
  DELETE FROM connection_notifications
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  -- Delete notifications older than 30 days
  DELETE FROM connection_notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old diagnostics
CREATE OR REPLACE FUNCTION cleanup_old_diagnostics()
RETURNS void AS $$
BEGIN
  -- Keep only last 50 diagnostics per user
  DELETE FROM connection_diagnostics
  WHERE id NOT IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM connection_diagnostics
    ) ranked
    WHERE rn <= 50
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup jobs (if pg_cron extension is available)
-- SELECT cron.schedule('cleanup-health-checks', '0 2 * * *', 'SELECT cleanup_old_health_check_results();');
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_old_notifications();');
-- SELECT cron.schedule('cleanup-diagnostics', '0 4 * * *', 'SELECT cleanup_old_diagnostics();');

-- Insert default global monitoring configuration
INSERT INTO monitoring_config (
  scope,
  scope_id,
  api_interval,
  network_interval,
  timeout,
  max_retries,
  reconnection_max_attempts,
  reconnection_base_delay,
  reconnection_max_delay,
  reconnection_backoff_multiplier,
  reconnection_jitter,
  notifications_enabled,
  notifications_types,
  notifications_methods,
  notifications_throttle,
  persistence_enabled,
  persistence_storage_type,
  persistence_encrypt
) VALUES (
  'global',
  NULL,
  30000,  -- 30 seconds
  60000,  -- 1 minute
  10000,  -- 10 seconds
  3,
  10,
  1000,   -- 1 second
  60000,  -- 1 minute
  2.0,
  true,
  true,
  ARRAY['connection_lost', 'connection_restored', 'service_unavailable', 'authentication_error', 'rate_limit_exceeded'],
  ARRAY['in_app', 'browser'],
  30000,  -- 30 seconds
  true,
  'localStorage',
  false
) ON CONFLICT (scope, scope_id) WHERE is_active = TRUE DO NOTHING;