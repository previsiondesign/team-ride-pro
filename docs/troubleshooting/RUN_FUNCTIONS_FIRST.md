# Run Functions First - Then Policies

## The Error

You got: `function public.is_user_coach() does not exist`

This means the functions weren't created before the policies tried to use them.

## Solution: Two-Step Process

### Step 1: Create Functions Only

1. **Open `FIX_RLS_FUNCTIONS_ONLY.sql`** (I just created this)
2. **Copy the ENTIRE file**
3. **Paste into Supabase SQL Editor**
4. **Click "Run"**
5. **Wait for "Success"**

This creates all 6 functions we need (3 functions × 2 signatures each).

### Step 2: Test Functions Work

After Step 1 succeeds, test with this query:

```sql
SELECT public.is_user_coach();
```

You should get `true` or `false` (not an error).

### Step 3: Update Policies

Once functions work, I'll give you the policy update script. But first, let's make sure the functions are created successfully.

---

**Run `FIX_RLS_FUNCTIONS_ONLY.sql` first, then let me know if it works!**


