-- Fix RLS Policies for season_settings and auto_assign_settings
-- These tables were missing proper policies, causing 406 errors

-- ============================================
-- Fix season_settings Policies
-- ============================================

-- Drop ALL existing policies (including any "FOR ALL" policies)
DROP POLICY IF EXISTS "Coaches can view season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can update season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can manage season settings" ON season_settings;

-- Create complete policies using functions
CREATE POLICY "Coaches can view season settings" ON season_settings
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can insert season settings" ON season_settings
    FOR INSERT WITH CHECK (public.is_user_coach());

CREATE POLICY "Coaches can update season settings" ON season_settings
    FOR UPDATE USING (public.is_user_coach());

-- ============================================
-- Fix auto_assign_settings Policies
-- ============================================

-- Drop ALL existing policies (including any "FOR ALL" policies)
DROP POLICY IF EXISTS "Coaches can view auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can update auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can manage auto assign settings" ON auto_assign_settings;

-- Create complete policies using functions
CREATE POLICY "Coaches can view auto assign settings" ON auto_assign_settings
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can insert auto assign settings" ON auto_assign_settings
    FOR INSERT WITH CHECK (public.is_user_coach());

CREATE POLICY "Coaches can update auto assign settings" ON auto_assign_settings
    FOR UPDATE USING (public.is_user_coach());

