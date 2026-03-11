-- Function to check if a coach has admin role in user_roles table.
-- Used by simplified login to determine admin status without a Supabase Auth session.
-- SECURITY DEFINER bypasses RLS so anon clients can call it via rpc().
-- Follows same pattern as verify_phone_number() in ADD_PHONE_AUTH_SUPPORT.sql.

CREATE OR REPLACE FUNCTION check_coach_is_admin(coach_id_to_check BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    coach_user_id UUID;
    coach_role TEXT;
BEGIN
    -- Step 1: Get the user_id from coaches table
    SELECT user_id INTO coach_user_id
    FROM coaches
    WHERE id = coach_id_to_check;

    -- If coach has no linked Supabase Auth user, they cannot be admin
    IF coach_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Step 2: Look up role in user_roles
    SELECT role INTO coach_role
    FROM user_roles
    WHERE user_id = coach_user_id;

    -- Check if role is coach-admin or admin
    RETURN coach_role IN ('coach-admin', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon (simplified login has no auth session) and authenticated
GRANT EXECUTE ON FUNCTION check_coach_is_admin(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION check_coach_is_admin(BIGINT) TO authenticated;
