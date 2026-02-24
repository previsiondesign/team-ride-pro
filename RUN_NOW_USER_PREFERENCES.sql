-- TeamRide Pro v3 - User preferences (cross-device sync)
-- Safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id uuid NOT NULL,
    pref_key text NOT NULL,
    pref_value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id, pref_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
    ON public.user_preferences (user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_preferences'
          AND policyname = 'user_preferences_select_own'
    ) THEN
        CREATE POLICY user_preferences_select_own
            ON public.user_preferences
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_preferences'
          AND policyname = 'user_preferences_insert_own'
    ) THEN
        CREATE POLICY user_preferences_insert_own
            ON public.user_preferences
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_preferences'
          AND policyname = 'user_preferences_update_own'
    ) THEN
        CREATE POLICY user_preferences_update_own
            ON public.user_preferences
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_preferences'
          AND policyname = 'user_preferences_delete_own'
    ) THEN
        CREATE POLICY user_preferences_delete_own
            ON public.user_preferences
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

COMMIT;
