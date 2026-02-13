-- Add settings JSONB blob columns for future-proof storage of extra options.
-- Any app key not in the main schema can be stored here and will be merged on load.

-- Rides: store any ride-level options that don't have a dedicated column
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

COMMENT ON COLUMN rides.settings IS 'Extra ride-level options (future-proof blob). Merged with ride on load.';

-- Season settings: store any season-level options that don't have a dedicated column
ALTER TABLE season_settings
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

COMMENT ON COLUMN season_settings.settings IS 'Extra season-level options (future-proof blob). Merged with season settings on load.';
