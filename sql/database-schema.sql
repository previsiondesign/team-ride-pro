-- Supabase Database Schema for MTB Team Practice Manager
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Roles table (links Supabase auth.users to roles)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('coach-admin', 'ride_leader', 'rider')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Riders table
CREATE TABLE IF NOT EXISTS riders (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    grade TEXT,
    gender TEXT,
    racing_group TEXT,
    fitness TEXT DEFAULT '5',
    photo TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Coaches table
CREATE TABLE IF NOT EXISTS coaches (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    level TEXT DEFAULT '1' CHECK (level IS NULL OR level IN ('1', '2', '3', 'N/A')),
    fitness TEXT DEFAULT '5',
    photo TEXT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to auth user if coach has account
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Rides table
CREATE TABLE IF NOT EXISTS rides (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    available_coaches BIGINT[] DEFAULT '{}',
    available_riders BIGINT[] DEFAULT '{}',
    assignments JSONB DEFAULT '{}',
    groups JSONB DEFAULT '[]',
    route_id BIGINT, -- Reference to routes table if needed
    cancelled BOOLEAN DEFAULT FALSE,
    published_groups BOOLEAN DEFAULT FALSE, -- Whether groups have been published to riders
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Rider Feedback table (per-ride, per-rider notes from ride leaders)
CREATE TABLE IF NOT EXISTS rider_feedback (
    id BIGSERIAL PRIMARY KEY,
    ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    rider_id BIGINT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notes TEXT,
    observed_fitness TEXT, -- Updated fitness observed during ride
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(ride_id, rider_id, coach_id)
);

-- Ride Notes table (general ride feedback)
CREATE TABLE IF NOT EXISTS ride_notes (
    id BIGSERIAL PRIMARY KEY,
    ride_id BIGINT NOT NULL UNIQUE REFERENCES rides(id) ON DELETE CASCADE,
    notes TEXT,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Rider Availability table (tracks availability per ride)
CREATE TABLE IF NOT EXISTS rider_availability (
    id BIGSERIAL PRIMARY KEY,
    ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    rider_id BIGINT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    available BOOLEAN DEFAULT TRUE,
    marked_absent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- If overridden by ride leader
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(ride_id, rider_id)
);

-- Season Settings table
CREATE TABLE IF NOT EXISTS season_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    start_date DATE,
    end_date DATE,
    practices JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Auto Assign Settings table
CREATE TABLE IF NOT EXISTS auto_assign_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    parameters JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Routes table (if needed for route management)
CREATE TABLE IF NOT EXISTS routes (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    strava_embed_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_date ON rides(date);
CREATE INDEX IF NOT EXISTS idx_rider_feedback_ride_id ON rider_feedback(ride_id);
CREATE INDEX IF NOT EXISTS idx_rider_feedback_rider_id ON rider_feedback(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_feedback_coach_id ON rider_feedback(coach_id);
CREATE INDEX IF NOT EXISTS idx_rider_availability_ride_id ON rider_availability(ride_id);
CREATE INDEX IF NOT EXISTS idx_rider_availability_rider_id ON rider_availability(rider_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_assign_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- User Roles: Only coach-admins can view and manage
-- Users can ALWAYS read their OWN role (this breaks recursion)
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Coach-admins can view all user roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
        OR NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'coach-admin')
    );

CREATE POLICY "Coach-admins can update user roles" ON user_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Riders: Coach-admins and ride leaders can view all, coach-admins can edit
CREATE POLICY "Authenticated users can view riders" ON riders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

-- Public can view limited rider data (name, grade, racing_group only)
CREATE POLICY "Public can view limited rider data" ON riders
    FOR SELECT USING (true); -- Will be filtered in application code

CREATE POLICY "Coach-admins can insert riders" ON riders
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can update riders" ON riders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can delete riders" ON riders
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Coaches: Coach-admins and ride leaders can view all, coach-admins can edit
CREATE POLICY "Authenticated users can view coaches" ON coaches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

-- Public can view limited coach data
CREATE POLICY "Public can view limited coach data" ON coaches
    FOR SELECT USING (true); -- Will be filtered in application code

CREATE POLICY "Coach-admins can insert coaches" ON coaches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can update coaches" ON coaches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Ride leaders can update own coach record" ON coaches
    FOR UPDATE USING (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'ride_leader'
        )
    );

CREATE POLICY "Coach-admins can delete coaches" ON coaches
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Rides: Coach-admins can do everything, ride leaders can view and update current rides
CREATE POLICY "Authenticated users can view rides" ON rides
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

-- Public can view upcoming rides
CREATE POLICY "Public can view upcoming rides" ON rides
    FOR SELECT USING (date >= CURRENT_DATE);

CREATE POLICY "Coach-admins can insert rides" ON rides
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can update rides" ON rides
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Ride leaders can update current/today's ride
CREATE POLICY "Ride leaders can update current ride" ON rides
    FOR UPDATE USING (
        date = CURRENT_DATE AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'ride_leader'
        )
    );

CREATE POLICY "Coach-admins can delete rides" ON rides
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Rider Feedback: Coach-admins and ride leaders can view and create
CREATE POLICY "Authenticated users can view rider feedback" ON rider_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

CREATE POLICY "Authenticated users can create rider feedback" ON rider_feedback
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        ) AND
        coach_id = auth.uid()
    );

CREATE POLICY "Authenticated users can update own feedback" ON rider_feedback
    FOR UPDATE USING (
        coach_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

-- Ride Notes: Coach-admins and ride leaders can view and edit
CREATE POLICY "Authenticated users can view ride notes" ON ride_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

CREATE POLICY "Authenticated users can upsert ride notes" ON ride_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('coach-admin', 'ride_leader')
        )
    );

-- Rider Availability: Public can update, authenticated can view and override
CREATE POLICY "Anyone can view rider availability" ON rider_availability
    FOR SELECT USING (true);

CREATE POLICY "Anyone can set rider availability" ON rider_availability
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update rider availability" ON rider_availability
    FOR UPDATE USING (true);

-- Season Settings: Only coach-admins
CREATE POLICY "Coach-admins can view season settings" ON season_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can manage season settings" ON season_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Auto Assign Settings: Only coach-admins
CREATE POLICY "Coach-admins can view auto assign settings" ON auto_assign_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Coach-admins can manage auto assign settings" ON auto_assign_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Routes: Only coach-admins
CREATE POLICY "Coach-admins can view routes" ON routes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

CREATE POLICY "Public can view routes" ON routes
    FOR SELECT USING (true);

CREATE POLICY "Coach-admins can manage routes" ON routes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'coach-admin'
        )
    );

-- Functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON coaches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rider_feedback_updated_at BEFORE UPDATE ON rider_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_notes_updated_at BEFORE UPDATE ON ride_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rider_availability_updated_at BEFORE UPDATE ON rider_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


