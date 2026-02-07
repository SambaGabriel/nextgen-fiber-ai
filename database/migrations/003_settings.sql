-- Settings Migration: User Preferences and Sessions
-- This migration creates tables for user preferences and session management

-- ============================================
-- USER PREFERENCES TABLE
-- ============================================
-- Stores user-specific settings like language, theme, timezone, notifications

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Display preferences
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'pt-br', 'es')),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY')),
    theme VARCHAR(10) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),

    -- Notification preferences (JSONB for flexibility)
    notification_email JSONB DEFAULT '{
        "jobAssigned": true,
        "jobUpdated": true,
        "newMessage": true,
        "rateCardImport": true,
        "productionSubmitted": true
    }'::jsonb,

    notification_inapp JSONB DEFAULT '{
        "jobAssigned": true,
        "jobUpdated": true,
        "newMessage": true,
        "rateCardImport": true,
        "productionSubmitted": true
    }'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();


-- ============================================
-- USER SESSIONS TABLE
-- ============================================
-- Tracks active sessions for security and remote logout

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Session identification
    token_jti VARCHAR(255) UNIQUE,  -- JWT ID for session tracking

    -- Device info
    device_info VARCHAR(255),       -- Combined device string
    browser VARCHAR(100),           -- Browser name + version
    os VARCHAR(100),                -- Operating system
    ip_address INET,                -- IP address
    location VARCHAR(255),          -- Geo-location (city, country)

    -- Timestamps
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    -- Session state
    is_revoked BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_jti ON user_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_revoked) WHERE is_revoked = FALSE;

-- Composite index for finding active sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_revoked, last_activity_at DESC);


-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on both tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- User Preferences: Users can only access their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- User Sessions: Users can only view/manage their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
CREATE POLICY "Users can insert own sessions" ON user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get or create user preferences
CREATE OR REPLACE FUNCTION get_or_create_user_preferences(p_user_id UUID)
RETURNS user_preferences AS $$
DECLARE
    prefs user_preferences;
BEGIN
    -- Try to get existing
    SELECT * INTO prefs FROM user_preferences WHERE user_id = p_user_id;

    -- Create if not exists
    IF prefs IS NULL THEN
        INSERT INTO user_preferences (user_id) VALUES (p_user_id)
        RETURNING * INTO prefs;
    END IF;

    RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all sessions for a user (except current)
CREATE OR REPLACE FUNCTION revoke_other_sessions(p_user_id UUID, p_current_jti VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE user_sessions
    SET is_revoked = TRUE
    WHERE user_id = p_user_id
      AND token_jti != p_current_jti
      AND is_revoked = FALSE;

    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all sessions for a user
CREATE OR REPLACE FUNCTION revoke_all_sessions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE user_sessions
    SET is_revoked = TRUE
    WHERE user_id = p_user_id
      AND is_revoked = FALSE;

    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < NOW() OR (is_revoked = TRUE AND updated_at < NOW() - INTERVAL '30 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- EXTEND PROFILES TABLE (if needed)
-- ============================================

-- Add columns to profiles if they don't exist
DO $$
BEGIN
    -- First name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'first_name') THEN
        ALTER TABLE profiles ADD COLUMN first_name VARCHAR(100);
    END IF;

    -- Last name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'last_name') THEN
        ALTER TABLE profiles ADD COLUMN last_name VARCHAR(100);
    END IF;

    -- Phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE profiles ADD COLUMN phone VARCHAR(50);
    END IF;

    -- Avatar URL
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;

    -- Last login
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'last_login_at') THEN
        ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMPTZ;
    END IF;

    -- Organization ID (for multi-tenant)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'organization_id') THEN
        ALTER TABLE profiles ADD COLUMN organization_id UUID;
    END IF;
END $$;


-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE user_preferences IS 'User display and notification preferences';
COMMENT ON TABLE user_sessions IS 'Active user sessions for security tracking and remote logout';
COMMENT ON FUNCTION get_or_create_user_preferences IS 'Gets existing preferences or creates default ones for a user';
COMMENT ON FUNCTION revoke_other_sessions IS 'Revokes all sessions except the current one';
COMMENT ON FUNCTION revoke_all_sessions IS 'Revokes all sessions for a user (used on password change)';
