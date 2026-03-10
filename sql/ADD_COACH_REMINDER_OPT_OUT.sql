-- Allow coaches to opt out of 4-hour DM reminders (self-service via button on the reminder itself)
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS slack_reminders_disabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN coaches.slack_reminders_disabled IS
  'If true, coach will not receive automated DM reminders for attendance polls. Set via Slack opt-out button.';
