-- Fix "Function Search Path Mutable" warnings from Supabase Security Advisor.
-- Adds SET search_path = public to all 7 flagged functions.
-- This prevents potential schema injection attacks.

-- 1. generate_invitation_token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. cleanup_expired_codes
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_codes
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. verify_phone_number
CREATE OR REPLACE FUNCTION verify_phone_number(phone_to_check TEXT)
RETURNS TABLE(
    exists_in_coaches BOOLEAN,
    exists_in_riders BOOLEAN,
    coach_id BIGINT,
    rider_id BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        EXISTS(SELECT 1 FROM coaches WHERE phone = phone_to_check) as exists_in_coaches,
        EXISTS(SELECT 1 FROM riders WHERE phone = phone_to_check) as exists_in_riders,
        (SELECT id FROM coaches WHERE phone = phone_to_check LIMIT 1)::BIGINT as coach_id,
        (SELECT id FROM riders WHERE phone = phone_to_check LIMIT 1)::BIGINT as rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. check_coach_is_admin
CREATE OR REPLACE FUNCTION check_coach_is_admin(coach_id_to_check BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    coach_user_id UUID;
    coach_role TEXT;
BEGIN
    SELECT user_id INTO coach_user_id
    FROM coaches
    WHERE id = coach_id_to_check;

    IF coach_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO coach_role
    FROM user_roles
    WHERE user_id = coach_user_id;

    RETURN coach_role IN ('coach-admin', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. normalize_phone
CREATE OR REPLACE FUNCTION normalize_phone(phone_input TEXT)
RETURNS TEXT AS $$
DECLARE
    digits_only TEXT;
    normalized TEXT;
BEGIN
    IF phone_input IS NULL OR phone_input = '' THEN
        RETURN NULL;
    END IF;

    digits_only := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');

    IF phone_input LIKE '+%' THEN
        RETURN phone_input;
    END IF;

    IF LENGTH(digits_only) = 10 THEN
        normalized := '+1' || digits_only;
    ELSIF LENGTH(digits_only) = 11 AND digits_only LIKE '1%' THEN
        normalized := '+' || digits_only;
    ELSIF LENGTH(digits_only) > 0 THEN
        normalized := '+' || digits_only;
    ELSE
        RETURN NULL;
    END IF;

    RETURN normalized;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. get_role_by_phone
CREATE OR REPLACE FUNCTION get_role_by_phone(phone_to_check TEXT)
RETURNS TEXT AS $$
DECLARE
    is_coach BOOLEAN;
    is_rider BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM coaches WHERE phone = phone_to_check) INTO is_coach;
    SELECT EXISTS(SELECT 1 FROM riders WHERE phone = phone_to_check) INTO is_rider;

    IF is_coach THEN
        RETURN 'ride_leader';
    ELSIF is_rider THEN
        RETURN 'rider';
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
