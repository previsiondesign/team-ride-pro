-- Fix Infinite Recursion in RLS Policies - Version 2 (Better Fix)
-- This version uses a security definer function to completely break recursion

-- Step 1: Drop ALL existing user_roles policies
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Coaches can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can update user roles" ON user_roles;

-- Step 2: Create a security definer function to check if user is coach
-- This function bypasses RLS, so it won't cause recursion
CREATE OR REPLACE FUNCTION public.is_user_coach(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role = 'coach'
  );
$$;

-- Step 3: Create new policies using the function (no recursion!)
-- Users can ALWAYS read their OWN role (this breaks the recursion)
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

-- Coaches can view all roles using the function (no recursion)
CREATE POLICY "Coaches can view all user roles" ON user_roles
    FOR SELECT USING (public.is_user_coach());

-- Allow coaches to insert user roles
CREATE POLICY "Coaches can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        public.is_user_coach()
        OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'coach')
    );

-- Allow coaches to update user roles
CREATE POLICY "Coaches can update user roles" ON user_roles
    FOR UPDATE USING (public.is_user_coach());

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_coach(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach() TO authenticated;


