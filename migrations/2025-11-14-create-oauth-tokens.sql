-- Create OAuth2 tokens table for storing Real-Debrid authentication tokens
-- This table stores OAuth2 access and refresh tokens securely

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_in INTEGER NOT NULL,
    scope TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT oauth_tokens_user_id_not_empty CHECK (length(user_id) > 0),
    CONSTRAINT oauth_tokens_access_token_not_empty CHECK (length(access_token) > 0),
    CONSTRAINT oauth_tokens_expires_in_positive CHECK (expires_in > 0)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_updated_at ON oauth_tokens(updated_at);

-- Enable Row Level Security
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own OAuth tokens
CREATE POLICY "Users can view their own OAuth tokens"
    ON oauth_tokens FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own OAuth tokens"
    ON oauth_tokens FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own OAuth tokens"
    ON oauth_tokens FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own OAuth tokens"
    ON oauth_tokens FOR DELETE
    USING (auth.uid()::text = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_oauth_tokens_updated_at_trigger
    BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_tokens_updated_at();

-- Add helpful comment
COMMENT ON TABLE oauth_tokens IS 'Stores OAuth2 authentication tokens for Real-Debrid integration';
COMMENT ON COLUMN oauth_tokens.user_id IS 'Identifier for the user (maps to Real-Debrid user ID or Supabase user ID)';
COMMENT ON COLUMN oauth_tokens.access_token IS 'OAuth2 access token - encrypted at rest';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'OAuth2 refresh token - encrypted at rest (nullable)';
COMMENT ON COLUMN oauth_tokens.token_type IS 'OAuth2 token type (usually "Bearer")';
COMMENT ON COLUMN oauth_tokens.expires_in IS 'Token expiration time in seconds';
COMMENT ON COLUMN oauth_tokens.scope IS 'OAuth2 scopes granted to the token';