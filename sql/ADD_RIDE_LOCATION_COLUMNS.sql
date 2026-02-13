-- Add location columns to rides table
-- Run this in your Supabase SQL Editor to add meet location support

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS time TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS meet_location TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS goals TEXT DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN rides.time IS 'Practice start time';
COMMENT ON COLUMN rides.end_time IS 'Practice end time';
COMMENT ON COLUMN rides.description IS 'Practice description';
COMMENT ON COLUMN rides.meet_location IS 'Meet location address';
COMMENT ON COLUMN rides.location_lat IS 'Meet location latitude';
COMMENT ON COLUMN rides.location_lng IS 'Meet location longitude';
COMMENT ON COLUMN rides.goals IS 'Practice goals';
