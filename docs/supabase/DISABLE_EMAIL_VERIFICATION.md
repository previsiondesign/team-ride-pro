# Disable Email Verification for Testing

Since you clicked the link immediately and still got an error, the easiest solution is to temporarily disable email verification so you can log in and test the app.

## Steps to Disable Email Verification

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard

2. **Select your project** (Teamride Pro Beta)

3. **Click "Authentication"** in the left sidebar

4. **Click "Providers"** in the submenu

5. **Find and click "Email"** in the list of providers

6. **Look for "Enable email confirmations"** or **"Confirm email"** toggle

7. **Toggle it OFF** (disable it)

8. **Click "Save"** or the save button

9. **Now try logging in** at `http://localhost:8000/mtb-roster.html`:
   - Use your email: acphillips@gmail.com
   - Use your password
   - You should be able to log in immediately!

## Important Notes

- ⚠️ **For Testing Only**: Keep email verification disabled only while testing
- 🔒 **Before Going Live**: Re-enable email verification for security
- ✅ **You can still log in**: The account exists, you just can't verify the email yet

## After You Can Log In

Once you're logged in, you'll need to assign yourself the "coach" role in Supabase (see Step 11 in SETUP_AUTH.md) to get full access.

## Why This Happened

The redirect URL in Supabase is set to `localhost:3000` but your server isn't running on that port, so the verification redirect failed. Disabling email verification lets you skip this step for now.


