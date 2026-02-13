-- Add deleted and rescheduled_from columns to rides table
-- Run this in your Supabase SQL Editor to support practice deletion and rescheduling

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rescheduled_from DATE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN rides.deleted IS 'Whether this ride has been deleted (soft delete)';
COMMENT ON COLUMN rides.rescheduled_from IS 'Original date if this ride was rescheduled';
COMMENT ON COLUMN rides.cancellation_reason IS 'Reason for cancellation if ride was cancelled';
