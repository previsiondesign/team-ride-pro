# Fix Migration Issues

## Current Issue: RLS Blocking Migration

**Error**: `new row violates row-level security policy for table "riders"` (and other tables)

**Cause**: Row Level Security (RLS) is enabled and requires authentication, but the migration script runs without an authenticated user session.

**Solution**: Temporarily disable RLS for migration, then re-enable it afterward.

## Migration Steps (Complete Process)

### Step 1: Add Missing Column (if needed)

If you haven't already, add the `published_groups` column:

1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Create a new query**
3. **Paste and run this SQL**:

```sql
-- Add published_groups column to rides table
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS published_groups BOOLEAN DEFAULT FALSE;
```

4. **Click "Run"**

### Step 2: Temporarily Disable RLS

1. **In SQL Editor**, create a new query
2. **Open the file** `sql/TEMPORARILY_DISABLE_RLS_FOR_MIGRATION.sql`
3. **Copy the ENTIRE contents** and paste into SQL Editor
4. **Click "Run"**

This disables RLS on all data tables, allowing the migration to insert data without authentication.

### Step 3: Run Migration Script

1. **Refresh your browser** (where you're running the migration)
2. **Open the browser console** (F12 → Console)
3. **Paste and run your migration script**
4. **Wait for migration to complete**

You should see success messages for all your data.

### Step 4: Re-enable RLS and Apply Policies

1. **In SQL Editor**, create a new query
2. **Open the file** `sql/RE_ENABLE_RLS_AFTER_MIGRATION.sql`
3. **Copy the ENTIRE contents** and paste into SQL Editor
4. **Click "Run"**

This re-enables RLS on all tables.

### Step 5: Apply Fixed RLS Policies

1. **In SQL Editor**, create a new query
2. **Open the file** `sql/FIX_RLS_RECURSION_COACH_ADMIN.sql`
3. **Copy the ENTIRE contents** and paste into SQL Editor
4. **Click "Run"**

This applies the security definer functions and fixes the RLS policies to prevent recursion.

## Why This Approach?

- **Migration needs no auth**: The migration script runs from localStorage without a user session
- **RLS requires auth**: RLS policies check user roles, which requires authentication
- **Solution**: Temporarily disable RLS for migration, then restore it with proper policies

## Security Note

RLS is disabled only during migration. After Step 4, RLS is re-enabled, and after Step 5, proper security policies are in place. The `user_roles` table RLS remains enabled throughout for security.

## Additional Issue: Coach Level Constraint Violations

If you see errors like `new row for relation "coaches" violates check constraint "coaches_level_check"`:

**Cause**: Some coaches have `level` values that aren't '1', '2', or '3' (the only valid values).

**Solution**: See `docs/supabase/FIX_COACH_LEVEL_MIGRATION.md` for details. Quick fix:
1. Run `sql/FIX_INVALID_COACH_LEVELS.sql` to fix any coaches already in the database
2. Re-migrate failed coaches using the script in the guide

## Previous Issues (Already Fixed)

If you encountered these earlier:

1. **Infinite recursion**: Fixed by `FIX_RLS_RECURSION_COACH_ADMIN.sql` (Step 5)
2. **Missing column**: Fixed by adding `published_groups` column (Step 1)
3. **RLS blocking migration**: Fixed by temporarily disabling RLS (Steps 2-4)

