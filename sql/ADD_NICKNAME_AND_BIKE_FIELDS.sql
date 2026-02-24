-- V3 New Fields: nickname, bike type (coaches), archived flag
-- These columns support the CSV import overhaul and record archiving.

-- ============ RIDERS TABLE ============
ALTER TABLE riders ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- ============ COACHES TABLE ============
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bike_manual BOOLEAN DEFAULT true;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bike_electric BOOLEAN DEFAULT false;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bike_primary TEXT DEFAULT 'manual';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
