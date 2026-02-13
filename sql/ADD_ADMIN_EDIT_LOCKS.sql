-- Track active admin edit session (single lock row)
CREATE TABLE IF NOT EXISTS admin_edit_locks (
    id TEXT PRIMARY KEY DEFAULT 'current',
    user_id UUID,
    email TEXT,
    user_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE admin_edit_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach-admins can manage admin edit locks" ON admin_edit_locks;
CREATE POLICY "Coach-admins can manage admin edit locks" ON admin_edit_locks
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coach-admin'
))
WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coach-admin'
));
