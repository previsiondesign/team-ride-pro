-- Enable RLS on slack-related tables flagged by Supabase Security Advisor.
-- These tables are written by Edge Functions (service role key, bypasses RLS)
-- and read by authenticated coach-admins from the browser client.

-- 1. ride_rider_slack_notes
ALTER TABLE ride_rider_slack_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach-admins can view slack notes" ON ride_rider_slack_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- 2. slack_attendance_polls
ALTER TABLE slack_attendance_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach-admins can view attendance polls" ON slack_attendance_polls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- 3. slack_poll_responses (not flagged yet but also missing RLS)
ALTER TABLE slack_poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach-admins can view poll responses" ON slack_poll_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );
