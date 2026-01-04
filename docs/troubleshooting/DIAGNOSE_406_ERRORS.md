# Diagnosing 406 Errors

## The Issue

The policies are already created (that's why you got the "already exists" error), but you're still getting 406 errors. This suggests:

1. **Your user might not have a "coach" role assigned** - the policies check for coach role
2. **Or there's a different issue with the requests**

## Quick Check: Do You Have a Coach Role?

The 406 errors happen because the RLS policies are checking if you're a coach, and if you don't have that role, the request is rejected.

### To Check/Fix Your Role:

1. **Go to Supabase Dashboard**
2. **Authentication → Users** (find your user)
3. **Copy your User ID** (UUID)

Then run this SQL in SQL Editor to check/assign your role:

```sql
-- Check your current role
SELECT * FROM user_roles WHERE user_id = 'YOUR_USER_ID_HERE';

-- If no results, assign yourself as coach:
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'coach')
ON CONFLICT (user_id) DO UPDATE SET role = 'coach';
```

Replace `YOUR_USER_ID_HERE` with your actual user ID from the Authentication → Users page.

---

**Once your role is assigned, the 406 errors should disappear and your season settings will load!**


