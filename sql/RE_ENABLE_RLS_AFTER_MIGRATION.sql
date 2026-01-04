-- Re-enable RLS After Data Migration
-- Run this AFTER running the migration script
-- This restores security policies

-- Re-enable RLS on all tables
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_assign_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_notes ENABLE ROW LEVEL SECURITY;

-- After running this, the RLS policies from FIX_RLS_RECURSION_COACH_ADMIN.sql
-- will be active and enforce proper access control


