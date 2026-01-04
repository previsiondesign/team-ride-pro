# Fix: Expired Email Verification Link

## The Problem
Email verification links expire after about 1 hour. If you clicked the link later, it's no longer valid.

## Quick Solutions

### Option 1: Request a New Verification Email (Recommended)

1. **Go to your app**: `http://localhost:8000/mtb-roster.html`

2. **Try to log in** with your email and password

3. **If it says "Please check your email"**, you'll need to request a new verification email:
   - I'll need to add a "Resend verification email" feature, OR
   - You can disable email verification temporarily for testing (see Option 2)

### Option 2: Disable Email Verification (For Testing Only)

This allows you to log in without verifying your email (good for testing):

1. **Go to Supabase Dashboard**
2. **Click "Authentication"** > **"Providers"**
3. **Click on "Email"** provider
4. **Toggle OFF** "Confirm email" (or "Enable email confirmations")
5. **Click "Save"**
6. **Now you can log in directly** without email verification

⚠️ **Important**: Turn this back ON for production to require email verification.

### Option 3: Verify Email Directly in Supabase (Quick Test)

1. **Go to Supabase Dashboard**
2. **Click "Authentication"** > **"Users"**
3. **Find your email** in the list
4. **Click on your user**
5. **Look for "Email Confirmed"** - you can manually verify it there if needed

## Best Solution for Now

For testing purposes, I recommend **Option 2** (disable email verification temporarily). Then:
- You can log in immediately
- Test the app functionality
- Re-enable email verification before going live

Would you like me to add a "Resend verification email" button to the login page?


