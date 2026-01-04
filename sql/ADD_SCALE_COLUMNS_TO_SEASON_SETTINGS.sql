-- Add fitness_scale and skills_scale columns to season_settings table
-- Run this in Supabase SQL Editor

ALTER TABLE season_settings 
ADD COLUMN IF NOT EXISTS fitness_scale INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS skills_scale INTEGER DEFAULT 3;

-- Add comments for documentation
COMMENT ON COLUMN season_settings.fitness_scale IS 'Maximum value for fitness/pace scale (default: 5)';
COMMENT ON COLUMN season_settings.skills_scale IS 'Maximum value for bike skills scale (default: 3)';

