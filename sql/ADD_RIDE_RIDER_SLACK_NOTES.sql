-- Slack attendance poll comments — per ride, per person (rider or coach)
-- Stores comments submitted via the "Add Comment" button in Slack attendance polls.
-- The Edge Function (using service role key) manages all rows; no RLS policies needed.

CREATE TABLE IF NOT EXISTS ride_rider_slack_notes (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id BIGINT REFERENCES riders(id) ON DELETE CASCADE,
  coach_id BIGINT REFERENCES coaches(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_person CHECK (rider_id IS NOT NULL OR coach_id IS NOT NULL),
  CONSTRAINT uq_ride_rider UNIQUE (ride_id, rider_id),
  CONSTRAINT uq_ride_coach UNIQUE (ride_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_ride ON ride_rider_slack_notes(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_rider ON ride_rider_slack_notes(rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_coach ON ride_rider_slack_notes(coach_id);
