-- Additional SQL for Phone Authentication Support
-- Run this AFTER running database-schema.sql
-- This adds support for phone-based authentication and updates roles to use 'coach-admin'

-- ============================================
-- 1. Update user_roles to use 'coach-admin' role
-- ============================================

-- Remove existing constraint
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Add new constraint with the correct 3 roles: coach-admin, ride_leader, rider
ALTER TABLE user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('coach-admin', 'ride_leader', 'rider'));

-- ============================================
-- 2. Update RLS policies to use 'coach-admin' role
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Coaches can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;

-- Create new policies that use 'coach-admin' role
-- Users can ALWAYS read their OWN role (this breaks recursion)
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

-- Coach-admins can view all roles
CREATE POLICY "Coach-admins can view all user roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Coach-admins can insert user roles
CREATE POLICY "Coach-admins can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
        OR NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'coach-admin')
    );

-- Coach-admins can update user roles
CREATE POLICY "Coach-admins can update user roles" ON user_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- ============================================
-- 3. Function to verify phone number exists
-- ============================================

-- Function to verify if a phone number exists in coaches or riders table
-- This can be called from Edge Functions or frontend (with proper permissions)
CREATE OR REPLACE FUNCTION verify_phone_number(phone_to_check TEXT)
RETURNS TABLE(
    exists_in_coaches BOOLEAN,
    exists_in_riders BOOLEAN,
    coach_id BIGINT,
    rider_id BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM coaches WHERE phone = phone_to_check) as exists_in_coaches,
        EXISTS(SELECT 1 FROM riders WHERE phone = phone_to_check) as exists_in_riders,
        (SELECT id FROM coaches WHERE phone = phone_to_check LIMIT 1)::BIGINT as coach_id,
        (SELECT id FROM riders WHERE phone = phone_to_check LIMIT 1)::BIGINT as rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION verify_phone_number(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_phone_number(TEXT) TO authenticated;

-- ============================================
-- 4. Function to normalize phone numbers to E.164 format
-- ============================================

-- Helper function to normalize phone numbers
-- Converts various formats to E.164: +14155551234
CREATE OR REPLACE FUNCTION normalize_phone(phone_input TEXT)
RETURNS TEXT AS $$
DECLARE
    digits_only TEXT;
    normalized TEXT;
BEGIN
    IF phone_input IS NULL OR phone_input = '' THEN
        RETURN NULL;
    END IF;
    
    -- Remove all non-numeric characters
    digits_only := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
    
    -- If already starts with +, return as-is (assuming it's already E.164)
    IF phone_input LIKE '+%' THEN
        RETURN phone_input;
    END IF;
    
    -- If 10 digits, assume US number and add +1
    IF LENGTH(digits_only) = 10 THEN
        normalized := '+1' || digits_only;
    -- If 11 digits and starts with 1, add +
    ELSIF LENGTH(digits_only) = 11 AND digits_only LIKE '1%' THEN
        normalized := '+' || digits_only;
    -- Otherwise, just add + (might need manual correction)
    ELSIF LENGTH(digits_only) > 0 THEN
        normalized := '+' || digits_only;
    ELSE
        RETURN NULL;
    END IF;
    
    RETURN normalized;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Optional: Normalize existing phone numbers
-- ============================================

-- Uncomment and run this to normalize existing phone numbers in your database
-- WARNING: Review the results before running in production!

/*
UPDATE coaches 
SET phone = normalize_phone(phone)
WHERE phone IS NOT NULL 
  AND phone != normalize_phone(phone);

UPDATE riders 
SET phone = normalize_phone(phone)
WHERE phone IS NOT NULL 
  AND phone != normalize_phone(phone);
*/

-- ============================================
-- 6. Add indexes for phone number lookups
-- ============================================

-- Indexes for faster phone number lookups
CREATE INDEX IF NOT EXISTS idx_coaches_phone ON coaches(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone) WHERE phone IS NOT NULL;

-- ============================================
-- 7. Add unique constraint on phone numbers (optional but recommended)
-- ============================================

-- Uncomment if you want to enforce unique phone numbers
-- This prevents duplicate phone numbers in coaches or riders tables

/*
-- For coaches
ALTER TABLE coaches 
ADD CONSTRAINT coaches_phone_unique UNIQUE (phone);

-- For riders  
ALTER TABLE riders 
ADD CONSTRAINT riders_phone_unique UNIQUE (phone);
*/

-- ============================================
-- 8. Function to get user role by phone number (for Edge Functions)
-- ============================================

-- This function can be used in Edge Functions to determine what role
-- should be assigned based on which table the phone number exists in
-- Note: This assumes coaches become ride_leader role, but you may need to adjust
-- based on your data structure (you may have a separate table or field to distinguish)
CREATE OR REPLACE FUNCTION get_role_by_phone(phone_to_check TEXT)
RETURNS TEXT AS $$
DECLARE
    is_coach BOOLEAN;
    is_rider BOOLEAN;
BEGIN
    -- Check if phone exists in coaches (these become ride_leader role)
    SELECT EXISTS(SELECT 1 FROM coaches WHERE phone = phone_to_check) INTO is_coach;
    
    -- Check if phone exists in riders
    SELECT EXISTS(SELECT 1 FROM riders WHERE phone = phone_to_check) INTO is_rider;
    
    -- Return appropriate role
    -- Note: You'll need to adjust this logic if you have a way to distinguish
    -- coach-admin from ride_leader (e.g., a field in coaches table)
    IF is_coach THEN
        RETURN 'ride_leader';  -- Default to ride_leader, adjust as needed
    ELSIF is_rider THEN
        RETURN 'rider';
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_role_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_role_by_phone(TEXT) TO authenticated;

-- ============================================
-- Notes:
-- ============================================
-- 
-- 1. Phone numbers should be stored in E.164 format: +14155551234
-- 2. The verify_phone_number function can be called from Edge Functions
-- 3. After successful phone auth, use get_role_by_phone to determine role
-- 4. Then insert into user_roles table with the appropriate role
-- 5. Consider normalizing all existing phone numbers before going live
-- 6. Roles are now: 'coach-admin', 'ride_leader', 'rider'
--
-- ============================================
