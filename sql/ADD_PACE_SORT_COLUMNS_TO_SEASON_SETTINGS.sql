-- Add pace scale sorting columns to season_settings table

ALTER TABLE season_settings
    ADD COLUMN IF NOT EXISTS pace_scale_order text DEFAULT 'fastest_to_slowest',
    ADD COLUMN IF NOT EXISTS group_pace_order text DEFAULT 'fastest_to_slowest';

COMMENT ON COLUMN season_settings.pace_scale_order IS 'Pace scale sorting direction (fastest_to_slowest or slowest_to_fastest)';
COMMENT ON COLUMN season_settings.group_pace_order IS 'Group ordering by pace (fastest_to_slowest or slowest_to_fastest)';
