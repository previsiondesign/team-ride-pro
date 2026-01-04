-- Fix Infinite Recursion in RLS Policies for Coach-Admin Role System
-- This fixes the recursion issue by using security definer functions
-- Run this in Supabase SQL Editor AFTER running database-schema.sql and ADD_PHONE_AUTH_SUPPORT.sql

-- ============================================
-- STEP 1: Create Security Definer Functions
-- ============================================
-- These functions bypass RLS, so they won't cause recursion

-- Function to check if user is a coach-admin
CREATE OR REPLACE FUNCTION public.is_user_coach_admin(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role = 'coach-admin'
  );
$$;

-- Function to check if user is a ride leader
CREATE OR REPLACE FUNCTION public.is_user_ride_leader(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role = 'ride_leader'
  );
$$;

-- Function to check if user is coach-admin OR ride leader
CREATE OR REPLACE FUNCTION public.is_user_coach_admin_or_ride_leader(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role IN ('coach-admin', 'ride_leader')
  );
$$;

-- Grant execute permissions (use full signature with parameter type)
GRANT EXECUTE ON FUNCTION public.is_user_coach_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_admin_or_ride_leader(UUID) TO authenticated;

-- ============================================
-- STEP 2: Fix user_roles Policies
-- ============================================

-- Drop all existing user_roles policies
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Coach-admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coach-admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coach-admins can update user roles" ON user_roles;

-- Create new user_roles policies using functions (no recursion!)
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Coach-admins can view all user roles" ON user_roles
    FOR SELECT USING (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        public.is_user_coach_admin()
        OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'coach-admin')
    );

CREATE POLICY "Coach-admins can update user roles" ON user_roles
    FOR UPDATE USING (public.is_user_coach_admin());

-- ============================================
-- STEP 3: Fix riders Policies
-- ============================================

-- Drop existing riders policies that query user_roles
DROP POLICY IF EXISTS "Authenticated users can view riders" ON riders;
DROP POLICY IF EXISTS "Coach-admins can insert riders" ON riders;
DROP POLICY IF EXISTS "Coach-admins can update riders" ON riders;
DROP POLICY IF EXISTS "Coach-admins can delete riders" ON riders;

-- Recreate using functions (no recursion!)
CREATE POLICY "Authenticated users can view riders" ON riders
    FOR SELECT USING (public.is_user_coach_admin_or_ride_leader());

CREATE POLICY "Coach-admins can insert riders" ON riders
    FOR INSERT WITH CHECK (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can update riders" ON riders
    FOR UPDATE USING (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can delete riders" ON riders
    FOR DELETE USING (public.is_user_coach_admin());

-- ============================================
-- STEP 4: Fix coaches Policies
-- ============================================

-- Drop existing coaches policies
DROP POLICY IF EXISTS "Authenticated users can view coaches" ON coaches;
DROP POLICY IF EXISTS "Coach-admins can insert coaches" ON coaches;
DROP POLICY IF EXISTS "Coach-admins can update coaches" ON coaches;
DROP POLICY IF EXISTS "Ride leaders can update own coach record" ON coaches;
DROP POLICY IF EXISTS "Coach-admins can delete coaches" ON coaches;

-- Recreate using functions
CREATE POLICY "Authenticated users can view coaches" ON coaches
    FOR SELECT USING (public.is_user_coach_admin_or_ride_leader());

CREATE POLICY "Coach-admins can insert coaches" ON coaches
    FOR INSERT WITH CHECK (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can update coaches" ON coaches
    FOR UPDATE USING (public.is_user_coach_admin());

CREATE POLICY "Ride leaders can update own coach record" ON coaches
    FOR UPDATE USING (
        user_id = auth.uid() AND
        public.is_user_ride_leader()
    );

CREATE POLICY "Coach-admins can delete coaches" ON coaches
    FOR DELETE USING (public.is_user_coach_admin());

-- ============================================
-- STEP 5: Fix rides Policies
-- ============================================

-- Drop existing rides policies
DROP POLICY IF EXISTS "Authenticated users can view rides" ON rides;
DROP POLICY IF EXISTS "Public can view upcoming rides" ON rides;
DROP POLICY IF EXISTS "Coach-admins can insert rides" ON rides;
DROP POLICY IF EXISTS "Coach-admins can update rides" ON rides;
DROP POLICY IF EXISTS "Ride leaders can update current ride" ON rides;
DROP POLICY IF EXISTS "Coach-admins can delete rides" ON rides;

-- Recreate using functions
CREATE POLICY "Authenticated users can view rides" ON rides
    FOR SELECT USING (public.is_user_coach_admin_or_ride_leader());

CREATE POLICY "Public can view upcoming rides" ON rides
    FOR SELECT USING (date >= CURRENT_DATE);

CREATE POLICY "Coach-admins can insert rides" ON rides
    FOR INSERT WITH CHECK (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can update rides" ON rides
    FOR UPDATE USING (public.is_user_coach_admin());

CREATE POLICY "Ride leaders can update current ride" ON rides
    FOR UPDATE USING (
        date = CURRENT_DATE AND
        public.is_user_ride_leader()
    );

CREATE POLICY "Coach-admins can delete rides" ON rides
    FOR DELETE USING (public.is_user_coach_admin());

-- ============================================
-- STEP 6: Fix rider_feedback Policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view rider feedback" ON rider_feedback;
DROP POLICY IF EXISTS "Authenticated users can create rider feedback" ON rider_feedback;
DROP POLICY IF EXISTS "Authenticated users can update own feedback" ON rider_feedback;

CREATE POLICY "Authenticated users can view rider feedback" ON rider_feedback
    FOR SELECT USING (public.is_user_coach_admin_or_ride_leader());

CREATE POLICY "Authenticated users can create rider feedback" ON rider_feedback
    FOR INSERT WITH CHECK (
        public.is_user_coach_admin_or_ride_leader() AND
        coach_id = auth.uid()
    );

CREATE POLICY "Authenticated users can update own feedback" ON rider_feedback
    FOR UPDATE USING (
        coach_id = auth.uid() AND
        public.is_user_coach_admin_or_ride_leader()
    );

-- ============================================
-- STEP 7: Fix ride_notes Policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view ride notes" ON ride_notes;
DROP POLICY IF EXISTS "Authenticated users can upsert ride notes" ON ride_notes;

CREATE POLICY "Authenticated users can view ride notes" ON ride_notes
    FOR SELECT USING (public.is_user_coach_admin_or_ride_leader());

CREATE POLICY "Authenticated users can upsert ride notes" ON ride_notes
    FOR ALL USING (public.is_user_coach_admin_or_ride_leader());

-- ============================================
-- STEP 8: Fix season_settings Policies
-- ============================================

DROP POLICY IF EXISTS "Coach-admins can view season settings" ON season_settings;
DROP POLICY IF EXISTS "Coach-admins can manage season settings" ON season_settings;

CREATE POLICY "Coach-admins can view season settings" ON season_settings
    FOR SELECT USING (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can manage season settings" ON season_settings
    FOR ALL USING (public.is_user_coach_admin());

-- ============================================
-- STEP 9: Fix auto_assign_settings Policies
-- ============================================

DROP POLICY IF EXISTS "Coach-admins can view auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coach-admins can manage auto assign settings" ON auto_assign_settings;

CREATE POLICY "Coach-admins can view auto assign settings" ON auto_assign_settings
    FOR SELECT USING (public.is_user_coach_admin());

CREATE POLICY "Coach-admins can manage auto assign settings" ON auto_assign_settings
    FOR ALL USING (public.is_user_coach_admin());

-- ============================================
-- STEP 10: Fix routes Policies
-- ============================================

DROP POLICY IF EXISTS "Coach-admins can view routes" ON routes;
DROP POLICY IF EXISTS "Public can view routes" ON routes;
DROP POLICY IF EXISTS "Coach-admins can manage routes" ON routes;

CREATE POLICY "Coach-admins can view routes" ON routes
    FOR SELECT USING (public.is_user_coach_admin());

CREATE POLICY "Public can view routes" ON routes
    FOR SELECT USING (true);

CREATE POLICY "Coach-admins can manage routes" ON routes
    FOR ALL USING (public.is_user_coach_admin());

