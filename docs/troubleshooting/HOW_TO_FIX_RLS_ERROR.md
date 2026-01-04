# Fix: Infinite Recursion RLS Error

## The Problem

Your console shows:
```
infinite recursion detected in policy for relation "user_roles"
```

This is causing all your data to fail loading (riders, coaches, rides, season_settings, etc.).

## Why This Happens

The RLS policies for `user_roles` are checking if a user is a coach by querying `user_roles` table. But to query `user_roles`, it needs to check the policy again, which queries `user_roles` again... infinite loop!

## The Fix

You need to fix the RLS policies in Supabase. Here's how:

### Step 1: Open Supabase SQL Editor

1. Go to **Supabase Dashboard** → Your Project
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"** (or the "+" button)

### Step 2: Run the Fix Script

1. Open the file `FIX_RLS_RECURSION.sql` in your project folder
2. Copy the ENTIRE contents
3. Paste it into the Supabase SQL Editor
4. Click **"Run"** (or press Ctrl+Enter)

### Step 3: Verify It Works

1. Go back to your app
2. **Refresh the page** (hard refresh: Ctrl+Shift+R)
3. Log in again
4. Check the browser console (F12) - errors should be gone!
5. Your data should load immediately

## What the Fix Does

The fix creates a policy that allows users to read their **own** role first, which breaks the infinite loop:

1. ✅ User can read their own role (no recursion needed)
2. ✅ Once they can read their own role, the "coach" check works
3. ✅ Coaches can then read all roles
4. ✅ Other policies can check roles without recursion

## Troubleshooting

### Still Getting Errors?

1. Make sure you ran the ENTIRE script (all 4 policy statements)
2. Check for typos - copy/paste the exact text from `FIX_RLS_RECURSION.sql`
3. Try refreshing the browser (hard refresh: Ctrl+Shift+R)
4. Check the console again - errors should be different if the fix worked

### Need to Revert?

If something goes wrong, you can drop all policies and recreate them:

```sql
-- Drop all user_roles policies
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Coaches can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can update user roles" ON user_roles;
```

Then re-run the fix script.

---

**After fixing, your data should load immediately on login without needing a refresh!**


