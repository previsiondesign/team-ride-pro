# Fix Email Verification Redirect Issue

## The Problem
When you click the email verification link, it tries to redirect to `localhost:3000` but your app isn't running on that port, causing a connection error.

## Quick Fix: Update Supabase Redirect URLs

You need to add your actual local URL to Supabase's allowed redirect URLs:

### Step 1: Find Your Local URL
- If you're using Python's http.server: `http://localhost:8000`
- If you're using a different port, use that instead
- Check your browser's address bar to see what port you're using

### Step 2: Add It to Supabase

1. **Go to Supabase Dashboard**
2. **Click "Authentication"** in the left sidebar
3. **Click "URL Configuration"** (or look for "Redirect URLs" or "Site URL")
4. **Under "Redirect URLs"**, click **"+ Add URL"** or **"Add redirect URL"**
5. **Add your local URL:**
   - If using port 8000: `http://localhost:8000`
   - If using port 3000: `http://localhost:3000`
   - Or add both: `http://localhost:8000/**` and `http://localhost:3000/**`
   - The `/**` at the end means "any path on this domain"
6. **Also set the "Site URL"** (if there's a field for it):
   - Set it to: `http://localhost:8000` (or your port)
7. **Click "Save"**

### Step 3: Try Again

1. **Request a new verification email** (if needed)
2. **Click the link in the new email**
3. **It should now redirect to your app** instead of showing an error

## Alternative: Manual Verification

If you just want to verify your account without fixing the redirect:

1. **Copy the access token** from the URL (the long string after `#access_token=`)
2. **Open your app** at `http://localhost:8000/mtb-roster.html` (or your port)
3. **Open browser console** (F12)
4. **Run this command:**
   ```javascript
   const token = 'PASTE_YOUR_ACCESS_TOKEN_HERE';
   const { data, error } = await supabase.auth.setSession({ access_token: token, refresh_token: '' });
   ```
5. **Refresh the page** - you should now be logged in

## For Production

When you deploy to Netlify/Vercel, make sure to:
- Add your production URL to Supabase redirect URLs
- Update the Site URL in Supabase to your production URL


