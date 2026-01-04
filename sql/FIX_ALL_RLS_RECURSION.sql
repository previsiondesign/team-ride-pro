-- Comprehensive Fix for Infinite Recursion in RLS Policies
-- This fixes ALL policies that query user_roles, not just user_roles policies

-- ============================================
-- STEP 1: Create Security Definer Functions
-- ============================================
-- These functions bypass RLS, so they won't cause recursion

-- Function to check if user is a coach
CREATE OR REPLACE FUNCTION public.is_user_coach(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role = 'coach'
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

-- Function to check if user is coach OR ride leader
CREATE OR REPLACE FUNCTION public.is_user_coach_or_ride_leader(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role IN ('coach', 'ride_leader')
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_user_coach(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_or_ride_leader(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_or_ride_leader() TO authenticated;

-- ============================================
-- STEP 2: Fix user_roles Policies
-- ============================================

-- Drop all existing user_roles policies
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Coaches can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can update user roles" ON user_roles;

-- Create new user_roles policies using functions
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Coaches can view all user roles" ON user_roles
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        public.is_user_coach()
        OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'coach')
    );

CREATE POLICY "Coaches can update user roles" ON user_roles
    FOR UPDATE USING (public.is_user_coach());

-- ============================================
-- STEP 3: Fix riders Policies (replace user_roles queries)
-- ============================================

-- Drop existing riders policies that query user_roles
DROP POLICY IF EXISTS "Authenticated users can view riders" ON riders;
DROP POLICY IF EXISTS "Coaches can insert riders" ON riders;
DROP POLICY IF EXISTS "Coaches can update riders" ON riders;
DROP POLICY IF EXISTS "Coaches can delete riders" ON riders;

-- Recreate using functions
CREATE POLICY "Authenticated users can view riders" ON riders
    FOR SELECT USING (public.is_user_coach_or_ride_leader());

CREATE POLICY "Coaches can insert riders" ON riders
    FOR INSERT WITH CHECK (public.is_user_coach());

CREATE POLICY "Coaches can update riders" ON riders
    FOR UPDATE USING (public.is_user_coach());

CREATE POLICY "Coaches can delete riders" ON riders
    FOR DELETE USING (public.is_user_coach());

-- ============================================
-- STEP 4: Fix coaches Policies (replace user_roles queries)
-- ============================================

-- Drop existing coaches policies that query user_roles
DROP POLICY IF EXISTS "Authenticated users can view coaches" ON coaches;
DROP POLICY IF EXISTS "Coaches can insert coaches" ON coaches;
DROP POLICY IF EXISTS "Coaches can update coaches" ON coaches;
DROP POLICY IF EXISTS "Ride leaders can update own coach record" ON coaches;
DROP POLICY IF EXISTS "Coaches can delete coaches" ON coaches;

-- Recreate using functions
CREATE POLICY "Authenticated users can view coaches" ON coaches
    FOR SELECT USING (public.is_user_coach_or_ride_leader());

CREATE POLICY "Coaches can insert coaches" ON coaches
    FOR INSERT WITH CHECK (public.is_user_coach());

CREATE POLICY "Coaches can update coaches" ON coaches
    FOR UPDATE USING (public.is_user_coach());

CREATE POLICY "Ride leaders can update own coach record" ON coaches
    FOR UPDATE USING (
        user_id = auth.uid() AND public.is_user_ride_leader()
    );

CREATE POLICY "Coaches can delete coaches" ON coaches
    FOR DELETE USING (public.is_user_coach());

-- ============================================
-- STEP 5: Fix rides Policies (replace user_roles queries)
-- ============================================

-- Drop existing rides policies that query user_roles
DROP POLICY IF EXISTS "Authenticated users can view rides" ON rides;
DROP POLICY IF EXISTS "Coaches can insert rides" ON rides;
DROP POLICY IF EXISTS "Coaches can update rides" ON rides;
DROP POLICY IF EXISTS "Coaches can delete rides" ON rides;

-- Recreate using functions
CREATE POLICY "Authenticated users can view rides" ON rides
    FOR SELECT USING (public.is_user_coach_or_ride_leader());

CREATE POLICY "Coaches can insert rides" ON rides
    FOR INSERT WITH CHECK (public.is_user_coach());

CREATE POLICY "Coaches can update rides" ON rides
    FOR UPDATE USING (public.is_user_coach());

CREATE POLICY "Coaches can delete rides" ON rides
    FOR DELETE USING (public.is_user_coach());

-- ============================================
-- STEP 6: Fix other table policies that query user_roles
-- ============================================

-- Fix rider_feedback policies
DROP POLICY IF EXISTS "Ride leaders can insert feedback" ON rider_feedback;
DROP POLICY IF EXISTS "Ride leaders can update own feedback" ON rider_feedback;
DROP POLICY IF EXISTS "Coaches can view all feedback" ON rider_feedback;
DROP POLICY IF EXISTS "Coaches can delete feedback" ON rider_feedback;

CREATE POLICY "Ride leaders can insert feedback" ON rider_feedback
    FOR INSERT WITH CHECK (public.is_user_ride_leader());

CREATE POLICY "Ride leaders can update own feedback" ON rider_feedback
    FOR UPDATE USING (
        coach_id = auth.uid() AND public.is_user_ride_leader()
    );

CREATE POLICY "Coaches can view all feedback" ON rider_feedback
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can delete feedback" ON rider_feedback
    FOR DELETE USING (public.is_user_coach());

-- Fix ride_notes policies
DROP POLICY IF EXISTS "Ride leaders can insert notes" ON ride_notes;
DROP POLICY IF EXISTS "Ride leaders can update own notes" ON ride_notes;
DROP POLICY IF EXISTS "Coaches can view all notes" ON ride_notes;
DROP POLICY IF EXISTS "Coaches can delete notes" ON ride_notes;

CREATE POLICY "Ride leaders can insert notes" ON ride_notes
    FOR INSERT WITH CHECK (public.is_user_ride_leader());

CREATE POLICY "Ride leaders can update own notes" ON ride_notes
    FOR UPDATE USING (
        coach_id = auth.uid() AND public.is_user_ride_leader()
    );

CREATE POLICY "Coaches can view all notes" ON ride_notes
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can delete notes" ON ride_notes
    FOR DELETE USING (public.is_user_coach());

-- Fix season_settings policies
DROP POLICY IF EXISTS "Coaches can view season settings" ON season_settings;
DROP POLICY IF EXISTS "Coaches can update season settings" ON season_settings;

CREATE POLICY "Coaches can view season settings" ON season_settings
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can update season settings" ON season_settings
    FOR UPDATE USING (public.is_user_coach());

-- Fix auto_assign_settings policies
DROP POLICY IF EXISTS "Coaches can view auto assign settings" ON auto_assign_settings;
DROP POLICY IF EXISTS "Coaches can update auto assign settings" ON auto_assign_settings;

CREATE POLICY "Coaches can view auto assign settings" ON auto_assign_settings
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can update auto assign settings" ON auto_assign_settings
    FOR UPDATE USING (public.is_user_coach());

-- Fix routes policies
DROP POLICY IF EXISTS "Coaches can view routes" ON routes;
DROP POLICY IF EXISTS "Coaches can insert routes" ON routes;
DROP POLICY IF EXISTS "Coaches can update routes" ON routes;
DROP POLICY IF EXISTS "Coaches can delete routes" ON routes;

CREATE POLICY "Coaches can view routes" ON routes
    FOR SELECT USING (public.is_user_coach());

CREATE POLICY "Coaches can insert routes" ON routes
    FOR INSERT WITH CHECK (public.is_user_coach());

CREATE POLICY "Coaches can update routes" ON routes
    FOR UPDATE USING (public.is_user_coach());

CREATE POLICY "Coaches can delete routes" ON routes
    FOR DELETE USING (public.is_user_coach());


