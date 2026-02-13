-- Add missing columns to routes table for full route data persistence
-- This includes distance, elevation, estimated time, Strava URL, and fitness/skills ranges

-- Add strava_url column
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS strava_url TEXT;

-- Add distance column
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS distance TEXT;

-- Add elevation column
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS elevation TEXT;

-- Add estimated_time column
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS estimated_time TEXT;

-- Add fitness_min column (default 1)
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS fitness_min INTEGER DEFAULT 1;

-- Add fitness_max column
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS fitness_max INTEGER;

-- Add skills_min column (default 1)
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS skills_min INTEGER DEFAULT 1;

-- Add skills_max column
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS skills_max INTEGER;

-- Add comment to document the columns
COMMENT ON COLUMN routes.strava_url IS 'Extracted Strava route URL from embed code';
COMMENT ON COLUMN routes.distance IS 'Route distance (e.g., "22.6 mi" or "15.5 km")';
COMMENT ON COLUMN routes.elevation IS 'Route elevation gain (e.g., "3,079 ft" or "1000 m")';
COMMENT ON COLUMN routes.estimated_time IS 'Estimated ride time (e.g., "1:30:00" or "1:30-2:00")';
COMMENT ON COLUMN routes.fitness_min IS 'Minimum fitness level required for this route (default: 1)';
COMMENT ON COLUMN routes.fitness_max IS 'Maximum fitness level for this route (null = no max)';
COMMENT ON COLUMN routes.skills_min IS 'Minimum bike skills level required (default: 1)';
COMMENT ON COLUMN routes.skills_max IS 'Maximum bike skills level (null = no max)';
