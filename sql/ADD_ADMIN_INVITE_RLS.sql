-- Allow invited users to accept admin invitations and create their role

-- Allow invited users to update their own invitation (mark used)
CREATE POLICY "Invited users can update own invitation" ON admin_invitations
    FOR UPDATE
    USING (email = auth.email())
    WITH CHECK (email = auth.email());

-- Allow invited users to create their own coach-admin role
CREATE POLICY "Invited users can insert coach-admin role" ON user_roles
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'coach-admin'
        AND EXISTS (
            SELECT 1 FROM admin_invitations ai
            WHERE ai.email = auth.email()
            AND ai.used = false
            AND ai.expires_at > NOW()
        )
    );
