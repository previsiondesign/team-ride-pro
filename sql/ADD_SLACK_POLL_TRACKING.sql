-- Slack poll tracking tables
-- Run in Supabase SQL Editor

-- Tracks posted poll messages so we can update them with a live tally
CREATE TABLE IF NOT EXISTS slack_attendance_polls (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ride_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_attendance_polls_ride ON slack_attendance_polls(ride_id);

-- Tracks individual poll responses (who responded and how)
-- Enables: live tally on poll message, finding non-responders for DM reminders
CREATE TABLE IF NOT EXISTS slack_poll_responses (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  slack_user_id TEXT NOT NULL,
  rider_id BIGINT REFERENCES riders(id) ON DELETE SET NULL,
  coach_id BIGINT REFERENCES coaches(id) ON DELETE SET NULL,
  attending BOOLEAN NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_person CHECK (rider_id IS NOT NULL OR coach_id IS NOT NULL),
  UNIQUE(ride_id, slack_user_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_poll_responses_ride ON slack_poll_responses(ride_id);
CREATE INDEX IF NOT EXISTS idx_slack_poll_responses_user ON slack_poll_responses(slack_user_id);
