# Run the Fix Script to Restore Season Settings

## The Problem

The **406 errors** for `auto_assign_settings` are preventing your season setup data from loading. That's why the season info disappeared after the refresh.

## The Solution

You have `FIX_SEASON_AND_AUTO_ASSIGN_POLICIES.sql` open - **run it now** to fix the 406 errors!

### Steps:

1. **Copy the ENTIRE contents** of `FIX_SEASON_AND_AUTO_ASSIGN_POLICIES.sql`
2. **Go to Supabase Dashboard** → SQL Editor → New query
3. **Paste the script**
4. **Click "Run"**
5. **Wait for "Success"**

This will fix the RLS policies so the data can load properly.

## After Running the Script

1. **Go back to your app**
2. **Hard refresh** (Ctrl+Shift+R)
3. **Check console** - 406 errors should be GONE
4. **Your season settings should load** from the database!

---

**The season data IS saved in Supabase - it just can't load because of the 406 errors. Once you fix the policies, it will load automatically!**


