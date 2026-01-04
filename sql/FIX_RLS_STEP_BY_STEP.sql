-- Step-by-Step Fix for RLS Recursion
-- Run this in parts if the full script fails

-- ============================================
-- PART 1: Create Functions (Run this first)
-- ============================================

-- Drop functions if they exist
DROP FUNCTION IF EXISTS public.is_user_coach(UUID);
DROP FUNCTION IF EXISTS public.is_user_coach();
DROP FUNCTION IF EXISTS public.is_user_ride_leader(UUID);
DROP FUNCTION IF EXISTS public.is_user_ride_leader();
DROP FUNCTION IF EXISTS public.is_user_coach_or_ride_leader(UUID);
DROP FUNCTION IF EXISTS public.is_user_coach_or_ride_leader();

-- Function to check if user is a coach (with parameter)
CREATE OR REPLACE FUNCTION public.is_user_coach(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role = 'coach'
  );
END;
$$;

-- Function to check if user is a coach (no parameter - uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_user_coach()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'coach'
  );
END;
$$;

-- Function to check if user is a ride leader (with parameter)
CREATE OR REPLACE FUNCTION public.is_user_ride_leader(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role = 'ride_leader'
  );
END;
$$;

-- Function to check if user is a ride leader (no parameter)
CREATE OR REPLACE FUNCTION public.is_user_ride_leader()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ride_leader'
  );
END;
$$;

-- Function to check if user is coach OR ride leader (with parameter)
CREATE OR REPLACE FUNCTION public.is_user_coach_or_ride_leader(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id_param
    AND user_roles.role IN ('coach', 'ride_leader')
  );
END;
$$;

-- Function to check if user is coach OR ride leader (no parameter)
CREATE OR REPLACE FUNCTION public.is_user_coach_or_ride_leader()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('coach', 'ride_leader')
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_user_coach(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_ride_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_or_ride_leader(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_coach_or_ride_leader() TO authenticated;


