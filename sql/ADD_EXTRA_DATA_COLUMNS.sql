-- Add JSONB columns to store extended roster fields
ALTER TABLE riders ADD COLUMN IF NOT EXISTS extra_data JSONB;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS extra_data JSONB;
