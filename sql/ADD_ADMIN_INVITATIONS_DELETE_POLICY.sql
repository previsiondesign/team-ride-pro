-- Add DELETE policy for admin_invitations
-- Allow coach-admins to delete invitations

CREATE POLICY "Coach-admins can delete invitations" ON admin_invitations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );
