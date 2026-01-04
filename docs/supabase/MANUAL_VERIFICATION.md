# Manual Account Verification (Quick Fix)

If you're getting a connection error when clicking the email verification link, you can verify your account manually:

## Option 1: Extract Token from URL (Easiest)

1. **Look at the error page URL** - you should see something like:
   ```
   localhost:3000/#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Copy the ENTIRE URL** from your browser's address bar

3. **Change the port number** in the URL:
   - If it says `localhost:3000`, change it to `localhost:8000` (or whatever port you're using)
   - Or just change the file name: replace everything after the port with `verify-account.html`
   - Example: `http://localhost:8000/verify-account.html#access_token=...`

4. **Press Enter** - it should load the verification page and automatically verify you

## Option 2: Use the Verification Helper Page

I've created a special page (`verify-account.html`) that will handle the verification automatically.

1. **Make sure you're running a local server** on port 8000:
   ```bash
   python -m http.server 8000
   ```

2. **Copy the full URL** from the error page (including the `#access_token=...` part)

3. **Change the URL** to:
   - Replace `localhost:3000` with `localhost:8000`
   - Replace any filename with `verify-account.html`
   - Keep the `#access_token=...` part
   - Example: `http://localhost:8000/verify-account.html#access_token=eyJ...`

4. **Press Enter** - it will automatically verify your account and redirect you

## Option 3: Manual Browser Console Method

1. **Open your app** at `http://localhost:8000/mtb-roster.html`

2. **Open browser console** (Press F12, then click "Console" tab)

3. **Copy the access token** from the error page URL (the part after `#access_token=`)

4. **In the console, paste and run:**
   ```javascript
   const token = 'PASTE_YOUR_ACCESS_TOKEN_HERE';
   const client = getSupabaseClient();
   const { data, error } = await client.auth.setSession({ access_token: token, refresh_token: '' });
   console.log('Verification result:', data, error);
   ```

5. **If successful, refresh the page** - you should be logged in

## Fix the Redirect URL in Supabase

To fix this permanently, you need to add your local URL to Supabase:

1. Go to Supabase Dashboard
2. Click **Authentication** > **URL Configuration**
3. Under **Redirect URLs**, add: `http://localhost:8000/**`
4. Also set **Site URL** to: `http://localhost:8000`
5. Click **Save**

Then future verification emails will redirect correctly!


