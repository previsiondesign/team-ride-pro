-- Add skills column to riders and coaches tables
-- This allows saving bike skills ratings for each rider and coach

-- Add skills column to riders table
ALTER TABLE riders
ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT '3';

-- Add skills column to coaches table
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT '3';

-- Add comments for documentation
COMMENT ON COLUMN riders.skills IS 'Bike skills rating (1 to skillsScale, stored as TEXT)';
COMMENT ON COLUMN coaches.skills IS 'Bike skills rating (1 to skillsScale, stored as TEXT)';


