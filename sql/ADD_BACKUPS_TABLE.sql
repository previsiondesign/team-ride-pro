-- Add backups table for storing complete data snapshots
CREATE TABLE IF NOT EXISTS backups (
    id BIGSERIAL PRIMARY KEY,
    backup_name TEXT NOT NULL,
    backup_data JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    backup_type TEXT DEFAULT 'manual' CHECK (backup_type IN ('manual', 'auto_login', 'auto_logout'))
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_created_by ON backups(created_by);

-- Enable RLS
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Policy: Only coach-admin can view all backups
CREATE POLICY "coach_admin_can_view_backups" ON backups
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'coach-admin'
        )
    );

-- Policy: Only coach-admin can create backups
CREATE POLICY "coach_admin_can_create_backups" ON backups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'coach-admin'
        )
    );

-- Policy: Only coach-admin can delete backups
CREATE POLICY "coach_admin_can_delete_backups" ON backups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'coach-admin'
        )
    );
