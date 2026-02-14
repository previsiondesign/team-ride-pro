-- Single row: when a second admin requests access, the lock holder can grant or deny.
CREATE TABLE IF NOT EXISTS admin_take_over_requests (
    id TEXT PRIMARY KEY DEFAULT 'current',
    requesting_user_id UUID,
    requesting_user_name TEXT,
    requesting_user_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'denied')),
    response_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    responded_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE admin_take_over_requests ENABLE ROW LEVEL SECURITY;

-- Coach-admins can read (both requester and lock holder need to see the row)
DROP POLICY IF EXISTS "Coach-admins can read take over requests" ON admin_take_over_requests;
CREATE POLICY "Coach-admins can read take over requests" ON admin_take_over_requests
FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coach-admin'
));

-- Any coach-admin can insert (requesting user creates the request)
DROP POLICY IF EXISTS "Coach-admins can insert take over requests" ON admin_take_over_requests;
CREATE POLICY "Coach-admins can insert take over requests" ON admin_take_over_requests
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coach-admin'
));

-- Only the current lock holder can update (grant/deny)
DROP POLICY IF EXISTS "Lock holder can update take over requests" ON admin_take_over_requests;
CREATE POLICY "Lock holder can update take over requests" ON admin_take_over_requests
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'coach-admin')
    AND auth.uid() = (SELECT user_id FROM admin_edit_locks WHERE id = 'current' LIMIT 1)
)
WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'coach-admin')
);

-- Any coach-admin can delete (needed so requesters can clear stale rows before inserting new requests)
DROP POLICY IF EXISTS "Coach-admins can delete take over requests" ON admin_take_over_requests;
CREATE POLICY "Coach-admins can delete take over requests" ON admin_take_over_requests
FOR DELETE TO authenticated
USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coach-admin'
));
