-- Temporarily Disable RLS for Data Migration
-- Run this BEFORE running the migration script
-- This allows the migration to insert data without authentication

-- Disable RLS on all tables
ALTER TABLE riders DISABLE ROW LEVEL SECURITY;
ALTER TABLE coaches DISABLE ROW LEVEL SECURITY;
ALTER TABLE routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE season_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE auto_assign_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE rides DISABLE ROW LEVEL SECURITY;
ALTER TABLE rider_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE ride_notes DISABLE ROW LEVEL SECURITY;

-- Note: user_roles table RLS should remain enabled for security
-- Migration script does not insert into user_roles table


