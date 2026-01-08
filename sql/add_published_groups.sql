-- Add published_groups column to rides table
-- This tracks whether group assignments have been published to coaches and riders

ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS published_groups BOOLEAN DEFAULT FALSE;

-- Update existing rides to have published_groups = false by default
UPDATE rides 
SET published_groups = FALSE 
WHERE published_groups IS NULL;








