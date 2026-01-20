# Deploy Admin Invitation Email Function

## Option 1: Using Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

**Windows (PowerShell):**
```powershell
# Using npm (if you have Node.js installed)
npm install -g supabase

# OR using Scoop (if you have Scoop package manager)
scoop install supabase

# OR using Chocolatey (if you have Chocolatey)
choco install supabase
```

**If npm doesn't work:**
1. Make sure Node.js is installed: https://nodejs.org/
2. Restart PowerShell after installing Node.js
3. Try `npm install -g supabase` again

### Step 2: Login to Supabase

```powershell
supabase login
```

This will open your browser to authenticate.

### Step 3: Link Your Project

```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:
- Go to Supabase Dashboard → Project Settings → General
- Look for "Reference ID" (starts with letters/numbers like `kweharxfvvjwrnswrooo`)

### Step 4: Deploy the Function

```powershell
supabase functions deploy send-admin-invitation --no-verify-jwt
```

---

## Option 2: Using Supabase Dashboard (Easier - No CLI Needed)

### Step 1: Create Function in Dashboard

1. Go to Supabase Dashboard → **Edge Functions**
2. Click **"Create a new function"**
3. Name it: `send-admin-invitation`
4. Click **"Create function"**

### Step 2: Copy the Code

1. Open the file: `supabase/functions/send-admin-invitation/index.ts` (I've already created this for you)
2. Copy ALL the code from that file
3. In Supabase Dashboard → Edge Functions → `send-admin-invitation`
4. Paste the code into the editor
5. Click **"Deploy"**

### Step 3: Configure Settings

1. In the function page, go to **Settings** tab
2. Under **"JWT Verification"**, toggle it **OFF** (or it will say "Verify JWT" - make sure it's disabled)
3. Click **Save**

### Step 4: Add Secrets

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add these secrets:
   - `RESEND_API_KEY` = Your Resend API key (get from resend.com)
   - `FROM_EMAIL` = Your email (can use `onboarding@resend.dev` for testing)
   - `SITE_URL` = `https://previsiondesign.github.io/team-ride-pro`

---

## Option 3: Manual Upload via Dashboard (Alternative)

If the dashboard editor doesn't work:

1. Go to Supabase Dashboard → Edge Functions
2. Click **"Create a new function"**
3. Name: `send-admin-invitation`
4. Instead of using the editor, you can:
   - Download the function as a ZIP
   - Extract it
   - Replace the code with your code
   - Upload it back

But Option 2 (Dashboard editor) is usually easier!

---

## Verify Deployment

After deploying (either method):

1. Go to Supabase Dashboard → Edge Functions → `send-admin-invitation`
2. Click **"Invoke"** tab
3. Test with this JSON:
   ```json
   {
     "email": "your-email@example.com",
     "invitationUrl": "https://previsiondesign.github.io/team-ride-pro/accept-invitation.html?token=test123",
     "inviterName": "Test Admin"
   }
   ```
4. Check the **Logs** tab to see if it worked

---

## Troubleshooting

### "supabase: command not found"
- Install Supabase CLI (see Option 1, Step 1)
- Or use Option 2 (Dashboard) instead

### "Project not linked"
- Run `supabase link --project-ref YOUR_PROJECT_REF`
- Or use Option 2 (Dashboard) instead

### Function not found after deployment
- Check you're in the right project
- Refresh the Edge Functions page
- Check the function name matches exactly: `send-admin-invitation`
