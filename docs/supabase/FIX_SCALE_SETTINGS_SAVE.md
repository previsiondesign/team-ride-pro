# Fix: Scale Settings Not Saving to Supabase

## Problem

When changing fitness scale (Relative Pace) or skills scale settings, you get an error:
```
Could not find the 'fitnessScale' column of 'season_settings' in the schema cache
```

The settings appear to save locally but revert after refresh because they're not being saved to Supabase.

## Root Cause

The `season_settings` table in Supabase doesn't have `fitness_scale` and `skills_scale` columns, but the application code was trying to save these values directly.

## Solution

### Step 1: Run SQL Migration

Run this SQL in your Supabase SQL Editor to add the missing columns:

```sql
-- Add fitness_scale and skills_scale columns to season_settings table
ALTER TABLE season_settings 
ADD COLUMN IF NOT EXISTS fitness_scale INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS skills_scale INTEGER DEFAULT 3;

-- Add comments for documentation
COMMENT ON COLUMN season_settings.fitness_scale IS 'Maximum value for fitness/pace scale (default: 5)';
COMMENT ON COLUMN season_settings.skills_scale IS 'Maximum value for bike skills scale (default: 3)';
```

**File**: `sql/ADD_SCALE_COLUMNS_TO_SEASON_SETTINGS.sql`

### Step 2: Code Updates (Already Done)

The following code changes have been made:

1. **`scripts/database.js`** - Updated `updateSeasonSettings()`:
   - Maps `fitnessScale` → `fitness_scale`
   - Maps `skillsScale` → `skills_scale`
   - Maps database format back to app format on return

2. **`scripts/database.js`** - Updated `getSeasonSettings()`:
   - Maps `fitness_scale` → `fitnessScale`
   - Maps `skills_scale` → `skillsScale`
   - Returns app-format data with defaults (5 for fitness, 3 for skills)

### Step 3: Test

1. Run the SQL migration in Supabase
2. Refresh your application
3. Go to Season Setup
4. Change the fitness scale and/or skills scale
5. Click "Update Scales"
6. Refresh the page
7. Verify the settings persist

## Files Changed

- ✅ `sql/ADD_SCALE_COLUMNS_TO_SEASON_SETTINGS.sql` (new file)
- ✅ `scripts/database.js` (updated `getSeasonSettings` and `updateSeasonSettings`)

## Database Schema

The `season_settings` table now includes:
- `fitness_scale` INTEGER DEFAULT 5
- `skills_scale` INTEGER DEFAULT 3

These columns store the maximum values for the rating scales.

