-- Add Schedule Conflict reason and options for scheduled absences
-- Run in Supabase SQL Editor after ADD_SCHEDULED_ABSENCES.sql

-- Allow new reason
ALTER TABLE scheduled_absences DROP CONSTRAINT IF EXISTS scheduled_absences_reason_check;
ALTER TABLE scheduled_absences ADD CONSTRAINT scheduled_absences_reason_check
    CHECK (reason IN ('injured', 'vacation', 'suspension', 'other', 'schedule_conflict'));

-- Remainder of season: when true, end_date is treated as season end (app can sync)
ALTER TABLE scheduled_absences ADD COLUMN IF NOT EXISTS remainder_of_season BOOLEAN DEFAULT false;

-- Specific practices: array of day-of-week (0=Sun .. 6=Sat). NULL or empty = absent all days in range
ALTER TABLE scheduled_absences ADD COLUMN IF NOT EXISTS specific_practice_days INTEGER[] DEFAULT NULL;

-- Exception dates: person is marked attending on these dates despite the absence (one-time exceptions)
ALTER TABLE scheduled_absences ADD COLUMN IF NOT EXISTS exception_dates TEXT[] DEFAULT NULL;

COMMENT ON COLUMN scheduled_absences.remainder_of_season IS 'When true, end_date should follow season end date';
COMMENT ON COLUMN scheduled_absences.specific_practice_days IS 'If set, absence applies only on these weekdays (0-6) within start_date..end_date';
COMMENT ON COLUMN scheduled_absences.exception_dates IS 'ISO date strings; person is not considered absent on these dates';
