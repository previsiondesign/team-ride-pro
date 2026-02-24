-- =====================================================
-- ADD SCHEDULED ABSENCES TABLE
-- Run this in the Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_absences (
    id BIGSERIAL PRIMARY KEY,
    person_type TEXT NOT NULL CHECK (person_type IN ('rider', 'coach')),
    person_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('injured', 'vacation', 'suspension', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    team_id UUID DEFAULT auth.uid()
);

ALTER TABLE scheduled_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their team absences"
    ON scheduled_absences FOR ALL
    USING (team_id = auth.uid());
