-- TeamRide Pro v3 safe schema patch
-- Purpose: Add missing v3 columns without breaking v2.
-- Safety principles:
--   1) Additive only (no DROP/RENAME/TYPE changes)
--   2) Idempotent (safe to run multiple times)
--   3) Conservative backfill from legacy columns where available

BEGIN;

-- =========================
-- 1) RIDERS (v3 additions)
-- =========================
ALTER TABLE IF EXISTS public.riders
    ADD COLUMN IF NOT EXISTS nickname text,
    ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS endurance integer,
    ADD COLUMN IF NOT EXISTS climbing integer,
    ADD COLUMN IF NOT EXISTS descending integer,
    ADD COLUMN IF NOT EXISTS bike_manual boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS bike_electric boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS bike_primary text;

-- Backfill v3 skill columns from legacy fields where possible.
UPDATE public.riders
SET
    endurance = COALESCE(endurance, fitness),
    descending = COALESCE(descending, skills)
WHERE
    endurance IS NULL
    OR descending IS NULL;

UPDATE public.riders
SET climbing = COALESCE(climbing, '3')
WHERE climbing IS NULL;

UPDATE public.riders
SET bike_primary = COALESCE(bike_primary, CASE WHEN bike_electric IS TRUE THEN 'electric' ELSE 'manual' END)
WHERE bike_primary IS NULL;


-- ==========================
-- 2) COACHES (v3 additions)
-- ==========================
ALTER TABLE IF EXISTS public.coaches
    ADD COLUMN IF NOT EXISTS nickname text,
    ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS endurance integer,
    ADD COLUMN IF NOT EXISTS climbing integer,
    ADD COLUMN IF NOT EXISTS descending integer,
    ADD COLUMN IF NOT EXISTS bike_manual boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS bike_electric boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS bike_primary text;

-- Backfill v3 skill columns from legacy fields where possible.
UPDATE public.coaches
SET
    endurance = COALESCE(endurance, fitness),
    descending = COALESCE(descending, skills)
WHERE
    endurance IS NULL
    OR descending IS NULL;

UPDATE public.coaches
SET climbing = COALESCE(climbing, '3')
WHERE climbing IS NULL;

UPDATE public.coaches
SET bike_primary = COALESCE(bike_primary, CASE WHEN bike_electric IS TRUE THEN 'electric' ELSE 'manual' END)
WHERE bike_primary IS NULL;


-- =======================================
-- 3) SEASON SETTINGS (v3 settings fields)
-- =======================================
ALTER TABLE IF EXISTS public.season_settings
    ADD COLUMN IF NOT EXISTS team_name text,
    ADD COLUMN IF NOT EXISTS endurance_scale integer,
    ADD COLUMN IF NOT EXISTS climbing_scale integer,
    ADD COLUMN IF NOT EXISTS descending_scale integer,
    ADD COLUMN IF NOT EXISTS endurance_scale_order text;

-- Backfill v3 season scale columns from legacy names where available.
UPDATE public.season_settings
SET
    endurance_scale = COALESCE(endurance_scale, fitness_scale),
    descending_scale = COALESCE(descending_scale, skills_scale),
    endurance_scale_order = COALESCE(endurance_scale_order, pace_scale_order)
WHERE
    endurance_scale IS NULL
    OR descending_scale IS NULL
    OR endurance_scale_order IS NULL;

-- Set conservative defaults for any missing values after backfill.
UPDATE public.season_settings
SET
    endurance_scale = COALESCE(endurance_scale, '5'),
    climbing_scale = COALESCE(climbing_scale, '3'),
    descending_scale = COALESCE(descending_scale, '3'),
    endurance_scale_order = COALESCE(endurance_scale_order, 'fastest_to_slowest');

COMMIT;

-- Optional sanity checks after running:
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='coaches' ORDER BY column_name;
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='riders' ORDER BY column_name;
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='season_settings' ORDER BY column_name;
