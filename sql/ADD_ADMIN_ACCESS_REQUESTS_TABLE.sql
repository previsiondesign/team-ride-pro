-- Stores admin access requests and one-time tokens for Approve from email link.
CREATE TABLE IF NOT EXISTS admin_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT,
    email TEXT NOT NULL,
    one_time_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_token ON admin_access_requests(one_time_token);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_used_at ON admin_access_requests(used_at);
ALTER TABLE admin_access_requests ENABLE ROW LEVEL SECURITY;
