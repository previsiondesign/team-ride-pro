-- Add cached preview image support for routes (avoids loading many Strava/WebGL embeds)
-- Run in Supabase SQL Editor. Then use "Cached map preview" when adding/editing a route.

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS cached_preview_data_url TEXT;

COMMENT ON COLUMN routes.cached_preview_data_url IS 'Optional data URL of a static map image; when set, shown instead of live Strava embed to avoid WebGL context limits';
