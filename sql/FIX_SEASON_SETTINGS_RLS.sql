-- Fix RLS Policies for season_settings table
-- The "FOR ALL" policy doesn't properly handle INSERT operations during upserts
-- This creates separate policies for SELECT, INSERT, and UPDATE

-- ============================================
-- Drop existing policies
-- ============================================
DROP POLICY IF EXISTS "Coach-admins can view season settings" ON season_settings;
DROP POLICY IF EXISTS "Coach-admins can manage season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can view season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can update season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can insert season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can manage season settings" ON season_settings;

-- ============================================
-- Create new policies with proper INSERT/UPDATE handling
-- ============================================

-- SELECT policy: Coach-admins can view season settings
CREATE POLICY "Coach-admins can view season settings" ON season_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- INSERT policy: Coach-admins can insert season settings
-- WITH CHECK is required for INSERT operations
CREATE POLICY "Coach-admins can insert season settings" ON season_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- UPDATE policy: Coach-admins can update season settings
CREATE POLICY "Coach-admins can update season settings" ON season_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- ============================================
-- Also fix auto_assign_settings (same issue)
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Coach-admins can view auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coach-admins can manage auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can view auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can update auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can insert auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can manage auto assign settings" ON auto_assign_settings;

-- SELECT policy: Coach-admins can view auto assign settings
CREATE POLICY "Coach-admins can view auto assign settings" ON auto_assign_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- INSERT policy: Coach-admins can insert auto assign settings
CREATE POLICY "Coach-admins can insert auto assign settings" ON auto_assign_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- UPDATE policy: Coach-admins can update auto assign settings
CREATE POLICY "Coach-admins can update auto assign settings" ON auto_assign_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

