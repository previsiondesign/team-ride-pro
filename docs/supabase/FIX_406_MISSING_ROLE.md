# Fix 406 Errors - Missing Coach Role

## The Problem

The policies are created, but you're still getting 406 errors. This means **you don't have a "coach" role assigned** in the database.

The RLS policies check `public.is_user_coach()` which looks for your user ID in the `user_roles` table with role = 'coach'. If you don't have that, all requests are blocked with 406 errors.

## The Solution: Assign Yourself as Coach

### Step 1: Find Your User ID

1. **Go to Supabase Dashboard**
2. **Click "Authentication"** in the left sidebar
3. **Click "Users"**
4. **Find your email** in the list
5. **Copy your User ID** (it's a UUID like `ba58f31a-67d2-452e-a281-502c2a700871`)

### Step 2: Assign Coach Role

1. **Go to SQL Editor** → New query
2. **Copy and paste this** (replace `YOUR_USER_ID_HERE` with your actual UUID):

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'coach')
ON CONFLICT (user_id) DO UPDATE SET role = 'coach';
```

3. **Replace `YOUR_USER_ID_HERE`** with your actual User ID from Step 1
4. **Click "Run"**

### Step 3: Test

1. **Go back to your app**
2. **Hard refresh** (Ctrl+Shift+R)
3. **Log out and log back in** (to refresh your session)
4. **Check console** - 406 errors should be GONE!

---

**Once you have the coach role, the 406 errors will disappear and your season settings will load!**


