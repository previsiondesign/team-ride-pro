# Apply RLS Fix in Parts

## The Problem

The full script might be failing because functions need to be created before policies can use them. Let's do this step-by-step.

## Solution: Run in Parts

### Step 1: Create Functions First

1. **Go to Supabase Dashboard** → SQL Editor → New query
2. **Open `FIX_RLS_STEP_BY_STEP.sql`**
3. **Copy ONLY Part 1** (the function creation part, lines 1-107)
4. **Paste and Run**
5. **Wait for "Success" message**

This creates all the functions we need.

### Step 2: Test Functions Work

Run this test query to verify functions were created:

```sql
SELECT public.is_user_coach();
```

You should get `true` or `false` (not an error).

### Step 3: Run Policy Updates

Once functions work, we can update the policies. But first, let me create a simpler policy update script that uses the functions correctly.

---

**For now, just run Part 1 (the functions) and let me know if it succeeds!**


