# How to Find Your User ID (UUID) in Supabase

## The Easy Way: Authentication → Users

The `auth.users` table is NOT in Table Editor. Here's the correct way:

1. **Go to Supabase Dashboard**
2. **Click "Authentication"** in the left sidebar (NOT "Table Editor")
3. **Click "Users"** in the submenu (appears under "Authentication")
4. **Find your email** in the list (looks like: acphillips@gmail.com)
5. **Click on your email** to open your user details
6. **Copy your User UUID** - it's shown at the top of the page
   - Looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - You can click the copy icon or select and copy

## Then Add to user_roles Table

After you have your UUID:

1. Go to **"Table Editor"** in the left sidebar
2. Click on **"user_roles"** table
3. Click **"Insert row"** (or the **"+"** button)
4. Fill in:
   - `user_id`: Paste your UUID
   - `role`: Type `coach`
5. Click **"Save"**
6. Refresh your app!

---

**That's it!** The Authentication → Users path is much easier than trying to find it in Table Editor.


