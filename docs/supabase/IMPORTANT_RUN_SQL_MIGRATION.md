# ⚠️ IMPORTANT: Run SQL Migration for Scale Settings

## Problem

Scale settings (fitness scale and skills scale) are not persisting because the database columns don't exist yet.

## Solution: Run SQL Migration

You **MUST** run this SQL in your Supabase SQL Editor before scale settings will work:

```sql
ALTER TABLE season_settings 
ADD COLUMN IF NOT EXISTS fitness_scale INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS skills_scale INTEGER DEFAULT 3;
```

## How to Run

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the SQL above
6. Click **Run** (or press F5)
7. You should see "Success. No rows returned"

## Verify It Worked

After running the migration:

1. Refresh your application
2. Change the fitness scale and/or skills scale
3. Click "Update Scales"
4. Refresh the page
5. The settings should now persist!

## Files

- SQL Migration: `sql/ADD_SCALE_COLUMNS_TO_SEASON_SETTINGS.sql`
- This file has the same SQL you need to run

---

**Until you run this migration, scale settings will continue to revert to defaults (5 for fitness, 3 for skills).**

