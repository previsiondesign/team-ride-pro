-- Expose auth user info to coach-admins for the Registered Users list
-- Returns email and name from auth.users, plus coach phone if linked

CREATE OR REPLACE FUNCTION public.get_users_with_auth()
RETURNS TABLE (
    user_id UUID,
    role TEXT,
    email TEXT,
    name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    matched_type TEXT,
    matched_id BIGINT,
    is_disabled BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        ur.user_id,
        ur.role,
        au.email,
        COALESCE(
            c_by_user.name,
            c_by_email.name,
            r_by_email.name,
            au.raw_user_meta_data->>'name',
            ''
        ) AS name,
        COALESCE(
            c_by_user.phone,
            c_by_email.phone,
            r_by_email.phone
        ) AS phone,
        ur.created_at,
        CASE
            WHEN c_by_user.id IS NOT NULL THEN 'coach'
            WHEN c_by_email.id IS NOT NULL THEN 'coach'
            WHEN r_by_email.id IS NOT NULL THEN 'rider'
            ELSE NULL
        END AS matched_type,
        COALESCE(c_by_user.id, c_by_email.id, r_by_email.id) AS matched_id,
        (ad.user_id IS NOT NULL) AS is_disabled
    FROM public.user_roles ur
    LEFT JOIN auth.users au ON au.id = ur.user_id
    LEFT JOIN public.coaches c_by_user ON c_by_user.user_id = ur.user_id
    LEFT JOIN public.coaches c_by_email ON lower(c_by_email.email) = lower(au.email)
    LEFT JOIN public.riders r_by_email ON lower(r_by_email.email) = lower(au.email)
    LEFT JOIN public.admin_disabled_users ad ON ad.user_id = ur.user_id
    WHERE EXISTS (
        SELECT 1 FROM public.user_roles admin_role
        WHERE admin_role.user_id = auth.uid()
        AND admin_role.role = 'coach-admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_users_with_auth() TO authenticated;
