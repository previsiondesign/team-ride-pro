-- V3 Skill Categories: Endurance, Climbing, Descending
-- These new columns are used exclusively by v3. The existing fitness/skills columns
-- remain in place for v2 compatibility. Both versions can coexist on the same database.

-- ============ RIDERS TABLE ============
ALTER TABLE riders ADD COLUMN IF NOT EXISTS endurance TEXT DEFAULT '5';
ALTER TABLE riders ADD COLUMN IF NOT EXISTS climbing TEXT DEFAULT '3';
ALTER TABLE riders ADD COLUMN IF NOT EXISTS descending TEXT DEFAULT '3';

-- Copy existing data into new columns
UPDATE riders SET endurance = fitness WHERE endurance = '5' OR endurance IS NULL;
UPDATE riders SET descending = skills WHERE descending = '3' OR descending IS NULL;

-- ============ COACHES TABLE ============
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS endurance TEXT DEFAULT '5';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS climbing TEXT DEFAULT '3';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS descending TEXT DEFAULT '3';

-- Copy existing data into new columns
UPDATE coaches SET endurance = fitness WHERE endurance = '5' OR endurance IS NULL;
UPDATE coaches SET descending = skills WHERE descending = '3' OR descending IS NULL;

-- ============ SEASON SETTINGS TABLE ============
ALTER TABLE season_settings ADD COLUMN IF NOT EXISTS endurance_scale INTEGER DEFAULT 5;
ALTER TABLE season_settings ADD COLUMN IF NOT EXISTS climbing_scale INTEGER DEFAULT 3;
ALTER TABLE season_settings ADD COLUMN IF NOT EXISTS descending_scale INTEGER DEFAULT 3;
ALTER TABLE season_settings ADD COLUMN IF NOT EXISTS endurance_scale_order TEXT DEFAULT 'fastest_to_slowest';

-- Copy existing scale settings into new columns
UPDATE season_settings SET
    endurance_scale = COALESCE(fitness_scale, 5),
    descending_scale = COALESCE(skills_scale, 3),
    endurance_scale_order = COALESCE(pace_scale_order, 'fastest_to_slowest');

-- ============ ROUTES TABLE ============
ALTER TABLE routes ADD COLUMN IF NOT EXISTS endurance_min INTEGER DEFAULT 1;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS endurance_max INTEGER;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS climbing_min INTEGER DEFAULT 1;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS climbing_max INTEGER;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS descending_min INTEGER DEFAULT 1;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS descending_max INTEGER;

-- Copy existing route ranges into new columns
UPDATE routes SET
    endurance_min = COALESCE(fitness_min, 1),
    endurance_max = fitness_max,
    descending_min = COALESCE(skills_min, 1),
    descending_max = skills_max;
