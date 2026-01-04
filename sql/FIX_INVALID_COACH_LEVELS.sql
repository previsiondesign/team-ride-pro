-- Fix Invalid Coach Level Values
-- Some coaches may have been migrated with invalid level values
-- This script updates any coaches with invalid levels to '1' (default)

UPDATE coaches
SET level = '1'
WHERE level IS NULL OR level NOT IN ('1', '2', '3');


