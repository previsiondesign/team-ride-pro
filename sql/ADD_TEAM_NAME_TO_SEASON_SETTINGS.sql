-- Add team_name column to season_settings table
-- This stores the team name displayed in the site header

ALTER TABLE season_settings
ADD COLUMN IF NOT EXISTS team_name TEXT DEFAULT '';
