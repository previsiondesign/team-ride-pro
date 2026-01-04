-- Add Races table and Time Estimation Settings to Season Settings
-- Run this in your Supabase SQL Editor

-- ============ RACES TABLE ============
CREATE TABLE IF NOT EXISTS races (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    race_date DATE,
    pre_ride_date DATE,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_races_race_date ON races(race_date);

-- Enable Row Level Security
ALTER TABLE races ENABLE ROW LEVEL SECURITY;

-- RLS Policies for races (same access as other settings - coach-admins only)
CREATE POLICY "Coach-admins can view races" ON races
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can insert races" ON races
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can update races" ON races
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can delete races" ON races
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- ============ TIME ESTIMATION SETTINGS ============
-- Add time_estimation_settings JSONB column to season_settings table
-- (Store as JSONB since it's a simple settings object)

ALTER TABLE season_settings 
ADD COLUMN IF NOT EXISTS time_estimation_settings JSONB DEFAULT '{
    "fastSpeedBase": 12.5,
    "slowSpeedBase": 10,
    "fastSpeedMin": 5.5,
    "slowSpeedMin": 4,
    "elevationAdjustment": 0.5,
    "lengthAdjustmentFactor": 0.1
}'::jsonb;

