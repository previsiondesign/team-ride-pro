# Simple Step-by-Step RLS Fix

## The Problem

The function doesn't exist because either:
1. Function creation failed
2. The script tried to use functions before creating them

## Solution: Run Functions Separately

### Step 1: Create Functions (Do This First!)

1. **Open Supabase Dashboard** → SQL Editor → New query
2. **Open `FIX_RLS_FUNCTIONS_ONLY.sql`**
3. **Copy the ENTIRE file** (it's just function creation, no policies)
4. **Paste into SQL Editor**
5. **Click "Run"**
6. **Wait for "Success" message**

If you get an error, tell me what it says!

### Step 2: Test Functions

After Step 1, test with:

```sql
SELECT public.is_user_coach();
```

Should return `true` or `false` (not an error).

### Step 3: Update Policies (After Functions Work)

Once functions are created and tested, I'll give you the policy update script.

---

**Try Step 1 now - just run `FIX_RLS_FUNCTIONS_ONLY.sql` and tell me what happens!**


