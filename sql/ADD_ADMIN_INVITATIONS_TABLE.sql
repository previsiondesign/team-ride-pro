-- Add Admin Invitations Table
-- This table stores invitation tokens for granting admin access to new users

CREATE TABLE IF NOT EXISTS admin_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_used ON admin_invitations(used);

-- Enable Row Level Security
ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_invitations

-- Only coach-admins can view all invitations
CREATE POLICY "Coach-admins can view all invitations" ON admin_invitations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );

-- Only coach-admins can create invitations
CREATE POLICY "Coach-admins can create invitations" ON admin_invitations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );

-- Only coach-admins can update invitations
CREATE POLICY "Coach-admins can update invitations" ON admin_invitations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );

-- Anyone can view an invitation by token (for the invitation acceptance page)
-- This is needed so users can access the invitation link without being authenticated
CREATE POLICY "Anyone can view invitation by token" ON admin_invitations
    FOR SELECT
    USING (true); -- Allow public access for invitation acceptance

-- Function to generate a secure random token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;
