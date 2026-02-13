-- Add start_location column to routes table
-- This stores which practice start location the route is associated with
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS start_location TEXT;

COMMENT ON COLUMN routes.start_location IS 'Practice start location this route is associated with (matches ride.meet_location)';
