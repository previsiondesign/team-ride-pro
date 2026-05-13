-- ============================================================================
-- ADD_UNIQUE_RIDE_PER_DATE.sql
--
-- Guard: at most one active (non-deleted, non-cancelled) ride per date.
--
-- Context: discovered on 2026-05-12 that two ride rows existed for 2026-05-13
-- (IDs 72 and 108). The Slack attendance poll landed on 72 with 29 attending /
-- 13 coaches; the planner rendered 108 (empty) because something re-generated
-- a ride row using the GRIT-Tuesday template's end_time (17:30) on a Wednesday.
-- Root cause in the ride auto-generation path is still TBD — this is a
-- defense-in-depth guard so duplicates can't silently coexist while we
-- investigate.
--
-- Implementation: a PARTIAL UNIQUE INDEX on (date) where the ride is neither
-- deleted nor cancelled. Soft-deleted/cancelled rides remain in the table for
-- audit purposes but no longer block a replacement.
--
-- Mirrors the active-ride filter in supabase/functions/slack-attendance/index.ts
-- getNextRide():
--   .or("cancelled.is.null,cancelled.eq.false")
--   .or("deleted.is.null,deleted.eq.false")
--
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================================

-- Sanity check before creating: fail loudly if any active dupes still exist.
-- (Should be zero now — ride 108 was deleted manually.)
DO $$
DECLARE
  dup_count INTEGER;
  dup_dates TEXT;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT date::text, ', ')
    INTO dup_count, dup_dates
  FROM (
    SELECT date
    FROM rides
    WHERE (deleted   IS NULL OR deleted   = false)
      AND (cancelled IS NULL OR cancelled = false)
    GROUP BY date
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot add unique constraint: % active duplicate ride date(s) still exist: %',
      dup_count, dup_dates;
  END IF;
END $$;

-- Partial unique index — at most one active ride per date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_date_unique_active
  ON rides (date)
  WHERE (deleted   IS NULL OR deleted   = false)
    AND (cancelled IS NULL OR cancelled = false);

COMMENT ON INDEX idx_rides_date_unique_active IS
  'Prevents duplicate active rides on the same date. Soft-deleted (deleted=true) and cancelled rides are exempt so historical/replaced rows can coexist with a fresh one.';
