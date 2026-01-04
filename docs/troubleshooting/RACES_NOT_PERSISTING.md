# Races Not Persisting - Troubleshooting Guide

## Issue
Races are being saved (`Races saved to Supabase` appears in console) but they don't load on refresh (`races: 0` in console).

## Most Common Cause: Migration Not Run

**The `races` table doesn't exist in your Supabase database yet.**

### Solution

1. **Run the SQL Migration:**
   - Open Supabase Dashboard → SQL Editor
   - Run `sql/ADD_RACES_AND_TIME_ESTIMATION.sql`
   - This creates the `races` table and adds RLS policies

2. **Verify the table was created:**
   - In Supabase Dashboard → Table Editor
   - You should see a `races` table

3. **Check RLS Policies:**
   - Make sure you've run `sql/FIX_SEASON_SETTINGS_RLS.sql` if you haven't already
   - This ensures proper permissions for coach-admins

4. **Test again:**
   - Refresh your application
   - Create a race and save it
   - Refresh again - races should now persist

## Other Possible Causes

### 1. RLS Policy Blocking SELECT

If the table exists but you're getting 0 races, check:
- Your user has the `coach-admin` role in `user_roles` table
- RLS policies allow SELECT for coach-admins

**Check your role:**
```sql
SELECT * FROM user_roles WHERE user_id = auth.uid();
```

**Should return:**
```
role: 'coach-admin'
```

### 2. Error Being Silently Caught

Check the browser console for error messages:
- Look for "Error fetching races:" messages
- Check for 406 (Not Acceptable) errors (RLS blocking)
- Check for table doesn't exist errors

### 3. Database Functions Not Available

Make sure `scripts/database.js` is loaded:
- Check Network tab in DevTools
- Verify `database.js` loads successfully
- Check that `getAllRaces` function exists in console:
  ```javascript
  typeof getAllRaces  // Should be "function"
  ```

## Debugging Steps

1. **Check if table exists:**
   ```sql
   SELECT * FROM races;
   ```
   - If this fails, table doesn't exist - run migration
   - If this returns rows, table exists and has data

2. **Check console logs:**
   - Look for "getAllRaces: Loaded X races from database"
   - If you see "Error fetching races:", check the error details

3. **Test directly in browser console:**
   ```javascript
   getAllRaces().then(races => console.log('Races:', races));
   ```
   - This will show you exactly what's being returned

## Expected Behavior

After running the migration:
- Creating a race should save it to Supabase
- Console should show "Races saved to Supabase"
- Refreshing should show "getAllRaces: Loaded X races from database" where X > 0
- Console log should show `races: X` (not 0)

