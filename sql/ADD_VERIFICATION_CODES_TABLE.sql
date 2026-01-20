-- Create verification_codes table to store temporary verification codes
-- This table stores codes sent to users for simplified login verification

CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_or_email TEXT NOT NULL,
    code TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'coach')),
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_email ON verification_codes(phone_or_email, code, verified);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id, user_type);

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create verification codes (for sending)
CREATE POLICY "Anyone can create verification codes" ON verification_codes
    FOR INSERT WITH CHECK (true);

-- Allow anonymous users to verify codes (for checking)
CREATE POLICY "Anyone can verify codes" ON verification_codes
    FOR SELECT USING (true);

-- Allow anonymous users to mark codes as verified
CREATE POLICY "Anyone can update verification codes" ON verification_codes
    FOR UPDATE USING (true);

-- Function to clean up expired codes (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_codes 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: You can set up a cron job in Supabase to run this periodically:
-- SELECT cron.schedule('cleanup-verification-codes', '0 * * * *', 'SELECT cleanup_expired_codes()');
