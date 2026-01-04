-- Create Security Definer Functions for RLS Fix
-- Run this FIRST before updating policies
-- These functions bypass RLS to check user roles without recursion

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.is_user_coach() CASCADE;
DROP FUNCTION IF EXISTS public.is_user_coach(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_user_ride_leader() CASCADE;
DROP FUNCTION IF EXISTS public.is_user_ride_leader(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_user_coach_or_ride_leader() CASCADE;
DROP FUNCTION IF EXISTS public.is_user_coach_or_ride_leader(UUID) CASCADE;

-- Function to check if current user is a coach (uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_user_coach()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Bypass RLS by using security definer
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coach'
  );
END;
$$;

-- Function to check if specified user is a coach
CREATE OR REPLACE FUNCTION public.is_user_coach(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
      AND user_roles.role = 'coach'
  );
END;
$$;

-- Function to check if current user is a ride leader
CREATE OR REPLACE FUNCTION public.is_user_ride_leader()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'ride_leader'
  );
END;
$$;

-- Function to check if specified user is a ride leader
CREATE OR REPLACE FUNCTION public.is_user_ride_leader(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
      AND user_roles.role = 'ride_leader'
  );
END;
$$;

-- Function to check if current user is coach OR ride leader
CREATE OR REPLACE FUNCTION public.is_user_coach_or_ride_leader()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('coach', 'ride_leader')
  );
END;
$$;

-- Function to check if specified user is coach OR ride leader
CREATE OR REPLACE FUNCTION public.is_user_coach_or_ride_leader(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
      AND user_roles.role IN ('coach', 'ride_leader')
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_or_ride_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_or_ride_leader(UUID) TO authenticated;


