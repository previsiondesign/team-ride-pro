-- Add CSV field mapping storage to season_settings
ALTER TABLE season_settings
ADD COLUMN IF NOT EXISTS csv_field_mappings JSONB DEFAULT '{}'::jsonb;
