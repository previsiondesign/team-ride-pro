-- Add started_at column to admin_edit_locks
-- This tracks when the admin first logged in / acquired the lock,
-- separate from updated_at which refreshes every 60s via heartbeat.

ALTER TABLE admin_edit_locks
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
