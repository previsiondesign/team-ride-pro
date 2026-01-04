# Quick Fix: Verify Your Account Right Now

Since you're getting the connection error, here's the fastest way to verify your account:

## Step-by-Step Instructions

1. **Look at the error page URL in your browser** - it should look like:
   ```
   localhost:3000/#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Copy the ENTIRE URL** including the `#access_token=` part

3. **Start your local server** (if not already running):
   - Open terminal/command prompt in your project folder
   - Run: `python -m http.server 8000`
   - Or if you have a different port, use that

4. **Modify the URL** to work with your server:
   - Change `localhost:3000` to `localhost:8000` (or your port)
   - Change to use the verification page: `http://localhost:8000/verify-account.html#access_token=...`
   - Keep everything after the `#` (the access_token part)

5. **Paste the modified URL in your browser and press Enter**

6. **It should automatically verify your account and redirect you!**

## Alternative: Just Log In Directly

If the verification link doesn't work, you can skip verification and log in:

1. **Open your app**: `http://localhost:8000/mtb-roster.html`

2. **Try logging in** with the email and password you just created

3. **If it says "Check your email"**, the account might already be verified, or Supabase might allow logins without verification. Try logging in anyway!

## Most Likely Issue

The redirect URL in Supabase might need to be exactly:
- `http://localhost:8000/**` (with the `**` at the end)
- AND `http://localhost:8000` (without anything after)

Make sure both are added in Supabase > Authentication > URL Configuration.


