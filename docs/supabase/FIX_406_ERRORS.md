# Fix 406 Errors for Season & Auto Assign Settings

## The Problem

You're getting `406 (Not Acceptable)` errors when trying to access:
- `season_settings` table
- `auto_assign_settings` table

This is because these tables are missing proper INSERT policies, and there may be conflicting old policies.

## The Solution

Run this quick fix script to add the missing policies.

### Steps:

1. **Open Supabase Dashboard** → SQL Editor → New query
2. **Open `FIX_SEASON_AND_AUTO_ASSIGN_POLICIES.sql`**
3. **Copy the ENTIRE file**
4. **Paste into SQL Editor**
5. **Click "Run"**
6. **Wait for "Success"**

This will:
- Drop any old/conflicting policies
- Add complete policies (SELECT, INSERT, UPDATE) using the security definer functions
- Fix the 406 errors

### After Running:

1. **Go back to your app**
2. **Hard refresh** (Ctrl+Shift+R)
3. **Check console** - 406 errors should be gone!

---

**Run `FIX_SEASON_AND_AUTO_ASSIGN_POLICIES.sql` now!**


