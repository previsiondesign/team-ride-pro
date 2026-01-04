-- Update Coach Level Constraint to Allow NULL and 'N/A'
-- This allows coaches to have no level assigned (NULL) or explicitly 'N/A'

-- Drop the existing constraint
ALTER TABLE coaches DROP CONSTRAINT IF EXISTS coaches_level_check;

-- Add new constraint that allows NULL, 'N/A', '1', '2', or '3'
ALTER TABLE coaches 
ADD CONSTRAINT coaches_level_check 
CHECK (level IS NULL OR level IN ('1', '2', '3', 'N/A'));


