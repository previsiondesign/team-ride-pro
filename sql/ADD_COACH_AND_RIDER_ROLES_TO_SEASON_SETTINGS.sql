-- Add coach_roles and rider_roles columns to season_settings table
-- Run this in your Supabase SQL Editor to support coach and rider roles persistence

ALTER TABLE season_settings
ADD COLUMN IF NOT EXISTS coach_roles JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS rider_roles JSONB DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN season_settings.coach_roles IS 'Array of coach role assignments: [{ roleName: string, coachId: number }]';
COMMENT ON COLUMN season_settings.rider_roles IS 'Array of rider role assignments: [{ roleName: string, riderId: number }]';
