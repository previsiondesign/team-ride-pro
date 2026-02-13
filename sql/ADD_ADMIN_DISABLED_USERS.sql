-- Track disabled admin users (prevents admin access)

CREATE TABLE IF NOT EXISTS admin_disabled_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    disabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    disabled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_admin_disabled_users_user_id ON admin_disabled_users(user_id);

ALTER TABLE admin_disabled_users ENABLE ROW LEVEL SECURITY;

-- Only coach-admins can manage disabled admins
CREATE POLICY "Coach-admins can view disabled admins" ON admin_disabled_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can insert disabled admins" ON admin_disabled_users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can delete disabled admins" ON admin_disabled_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'coach-admin'
        )
    );
