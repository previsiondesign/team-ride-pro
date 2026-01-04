-- Fix Infinite Recursion in RLS Policies
-- Run this in Supabase SQL Editor to fix the circular dependency

-- Step 1: Drop the existing problematic policies
DROP POLICY IF EXISTS "Coaches can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can update user roles" ON user_roles;

-- Step 2: Create new policies that break the recursion
-- Users can ALWAYS read their OWN role (this breaks the recursion)
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

-- Coaches can view all roles (this works now because they can read their own role first)
CREATE POLICY "Coaches can view all user roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'coach'
        )
    );

-- Allow coaches to insert user roles
-- Also allow if no coaches exist yet (for initial setup)
CREATE POLICY "Coaches can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'coach'
        )
        OR NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'coach')
    );

-- Allow coaches to update user roles
CREATE POLICY "Coaches can update user roles" ON user_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'coach'
        )
    );
