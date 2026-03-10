-- Add configurable reminder lead time to season_settings
-- Default: 4 (send reminders 4 notification-hours before practice)
-- Notification hours are 9 AM – 8 PM Pacific.
ALTER TABLE season_settings
ADD COLUMN IF NOT EXISTS reminder_lead_hours INTEGER DEFAULT 4;

COMMENT ON COLUMN season_settings.reminder_lead_hours IS
  'How many notification-window hours (9 AM – 8 PM) before practice to send DM reminders. Default 4.';
