# Complete Supabase Integration Guide

This guide will walk you through setting up Supabase for Team Ride Pro, including authentication, database setup, and data migration.

## Table of Contents
1. [Supabase Project Setup](#1-supabase-project-setup)
2. [Authentication Configuration](#2-authentication-configuration)
3. [Database Setup](#3-database-setup)
4. [Data Migration](#4-data-migration)
5. [Application Configuration](#5-application-configuration)
6. [Deployment](#6-deployment)

**Note**: For detailed GitHub deployment instructions including the Strava Route Proxy Server, see [GitHub Deployment Guide](./GITHUB_DEPLOYMENT_GUIDE.md).

---

## 1. Supabase Project Setup

### Step 1.1: Create/Login to Supabase Account
1. Go to https://supabase.com
2. Sign up or log in to your account
3. You should see your dashboard

### Step 1.2: Create a New Project
1. Click **"New Project"** button
2. Fill in project details:
   - **Name**: `team-ride-pro` (or your preferred name)
   - **Database Password**: Create a strong password (save this securely!)
   - **Region**: Choose closest to your users (e.g., `US West` for California)
3. Click **"Create new project"**
4. Wait 2-3 minutes for project initialization

### Step 1.3: Get Your API Credentials
1. In your project dashboard, go to **Settings** (gear icon) → **API**
2. You'll need two keys:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: Long string starting with `eyJ...`
3. Copy both values (you'll need them later)

---

## 2. Authentication Configuration

### Step 2.1: Enable Phone Authentication
1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **"Phone"** in the list
3. Toggle it **ON**
4. **Important**: Phone authentication requires a third-party SMS provider (Twilio, MessageBird, etc.)
   - For testing/development, you can use Supabase's test mode (limited functionality)
   - For production, you'll need to set up Twilio (see [Twilio Setup](#twilio-setup-for-sms))

### Step 2.2: Configure Email Authentication (for Admin Coaches)
1. In **Authentication** → **Providers**
2. Ensure **"Email"** is enabled (toggle should be ON - this is the "Enable Email provider" setting)
3. Configure email settings:
   - **Secure email change**: Toggle ON (recommended) - Requires confirmation on both old and new email
   - **Secure password change**: Toggle OFF (can enable later) - Requires recent login to change password
   - **Minimum password length**: Set to 8 or higher (recommended)

### Step 2.3: Configure Redirect URLs
1. Go to **Authentication** → **URL Configuration**
2. Add your site URLs:
   - **Site URL**: `http://localhost:8000` (for local testing)
   - **Redirect URLs**: Add:
     - `http://localhost:8000/**`
     - `https://teamridepro.com/**` (for production)
     - `https://*.github.io/**` (if using GitHub Pages)

### Step 2.4: Email Verification Settings (Optional - for Testing)

**Note**: Supabase's email verification is handled differently than in previous versions. By default:
- New users with email/password signup will receive a confirmation email
- You can manually verify users in the **Authentication** → **Users** section if needed for testing
- For production, keep email verification enabled (default behavior)

To manually verify a user for testing:
1. Go to **Authentication** → **Users**
2. Click on the user's email
3. Find the **"Email Confirmed"** status
4. If needed, you can manually confirm from the user details page

---

## 3. Database Setup

### Step 3.1: Run Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open the file `sql/database-schema.sql` from this project
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. You should see "Success. No rows returned" message

### Step 3.2: Verify Tables Created
1. Go to **Table Editor** in the sidebar
2. You should see these tables:
   - `user_roles`
   - `riders`
   - `coaches`
   - `rides`
   - `rider_feedback`
   - `ride_notes`
   - `rider_availability`
   - `season_settings`
   - `auto_assign_settings`
   - `routes`

### Step 3.3: Update Schema for Phone Authentication (Required)

We need to add a function to verify phone numbers. Run this SQL:

```sql
-- Function to verify if a phone number exists in coaches or riders table
CREATE OR REPLACE FUNCTION verify_phone_number(phone_to_check TEXT)
RETURNS TABLE(
    exists_in_coaches BOOLEAN,
    exists_in_riders BOOLEAN,
    coach_id BIGINT,
    rider_id BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM coaches WHERE phone = phone_to_check) as exists_in_coaches,
        EXISTS(SELECT 1 FROM riders WHERE phone = phone_to_check) as exists_in_riders,
        (SELECT id FROM coaches WHERE phone = phone_to_check LIMIT 1)::BIGINT as coach_id,
        (SELECT id FROM riders WHERE phone = phone_to_check LIMIT 1)::BIGINT as rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon users (for phone verification)
GRANT EXECUTE ON FUNCTION verify_phone_number(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_phone_number(TEXT) TO authenticated;
```

### Step 3.4: Update Schema for Phone Authentication Support

We need to run additional SQL to support phone authentication and ensure the role structure is correct (3 roles: coach-admin, ride_leader, rider).

**Where to paste this SQL:**

1. In your Supabase dashboard, go to **SQL Editor** (found in the left sidebar)
2. Click the **"+ New query"** button (top right of the SQL Editor area)
3. A new query tab will open
4. You'll see a large text area where you can type or paste SQL

**How to run the SQL:**

1. Open the file `sql/ADD_PHONE_AUTH_SUPPORT.sql` from this project in a text editor
2. **Copy the ENTIRE contents** of the file (Ctrl+A to select all, then Ctrl+C to copy)
3. **Paste it into the SQL Editor** in Supabase (click in the text area, then Ctrl+V)
4. Review the SQL code to make sure it pasted correctly
5. Click the **"Run"** button (usually a green "Run" button, or press **Ctrl+Enter**)
6. You should see a success message: "Success. No rows returned" or similar
7. If you see any errors, check the error message and ensure you ran `database-schema.sql` first (Step 3.1)

**What this SQL does:**

- Updates the `user_roles` table constraint to use the 3 correct roles: `'coach-admin'`, `'ride_leader'`, `'rider'`
- Updates RLS policies to use `'coach-admin'` role
- Creates functions for phone number verification and normalization
- Adds indexes for faster phone number lookups
- Creates helper functions for Edge Functions

**Important Notes:**

- Make sure you've completed Step 3.1 (running `database-schema.sql`) BEFORE running this
- This SQL will update existing policies and constraints - that's expected and correct
- If you see any errors, they may be harmless (like "policy does not exist") - the `IF EXISTS` clauses handle this

---

## 4. Data Migration

### Step 4.1: Export Current Local Data

1. Open your application in the browser
2. Open Developer Console (F12)
3. Run this command to export your data:

```javascript
// Export current localStorage data
const data = JSON.parse(localStorage.getItem('teamRideProData') || '{}');
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'team-ride-pro-export-' + new Date().toISOString().split('T')[0] + '.json';
a.click();
```

4. Save the downloaded file - this is your backup!

### Step 4.2: Prepare Migration Script

Create a migration script to import your data. See `docs/supabase/MIGRATION_SCRIPT.md` for the complete migration script.

**Quick Migration Steps:**

1. The migration script will:
   - Import all riders
   - Import all coaches
   - Import all rides
   - Import all routes
   - Import season settings
   - Import auto-assign settings

2. **Important Notes:**
   - Phone numbers must match exactly for authentication to work
   - You'll need to create admin coach accounts manually (see Step 4.3)
   - Non-admin coaches and riders will authenticate via phone number

### Step 4.3: Create First Coach-Admin Account

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Fill in:
   - **Email**: Your admin email
   - **Password**: Strong password
   - **Auto Confirm User**: Check this (or confirm via email)
4. Click **"Create user"**
5. Copy the **User UID** (UUID format) - you'll see this at the top of the user details page
6. Go to **SQL Editor** and create a new query
7. Paste and run this SQL (replace the placeholders with your actual values):

```sql
-- Replace USER_UUID_HERE with the UUID from step 5
-- Replace COACH_ID_HERE with the ID of your coach record (from coaches table)
INSERT INTO user_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'coach-admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'coach-admin';

-- Link the auth user to your coach record (if you have a coaches table entry)
-- If you don't have a coach record yet, you can skip this UPDATE statement
UPDATE coaches 
SET user_id = 'USER_UUID_HERE'
WHERE id = COACH_ID_HERE;
```

**Note**: If you don't have a coach record in the `coaches` table yet, you can create one later or skip the UPDATE statement. The important part is creating the `user_roles` entry with `'coach-admin'` role.

---

## 5. Application Configuration

### Step 5.1: Update Supabase Config

1. Open `scripts/supabase-config.js`
2. Replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

3. Use the values from Step 1.3

### Step 5.2: Update Main HTML File

The main application file (`teamridepro_v2.html`) needs to be updated to:
1. Include Supabase scripts
2. Initialize authentication
3. Load data from Supabase instead of localStorage

**This will be handled in a separate update step.**

---

## 6. Deployment

### Step 6.1: GitHub Pages (Testing)

1. Create a GitHub repository
2. Push your code to GitHub
3. Go to repository **Settings** → **Pages**
4. Select branch (usually `main`) and folder (`/root`)
5. Your site will be available at `https://username.github.io/repo-name`

### Step 6.2: Connect Custom Domain (teamridepro.com)

Since your domain is managed through Wix, you have two options:

#### Option A: Use Wix Domain with Subdomain
1. In Wix, create a subdomain (e.g., `app.teamridepro.com`)
2. Point it to your GitHub Pages URL using CNAME record
3. Update Supabase redirect URLs to include the subdomain

#### Option B: Transfer DNS to GitHub Pages
1. In Wix domain settings, find DNS management
2. Add CNAME record:
   - **Name**: `@` or `www`
   - **Value**: `username.github.io`
3. Update Supabase redirect URLs

### Step 6.3: Update Supabase URLs for Production

1. In Supabase dashboard: **Authentication** → **URL Configuration**
2. Update **Site URL** to: `https://teamridepro.com` (or your subdomain)
3. Add to **Redirect URLs**: `https://teamridepro.com/**`

---

## Authentication Flow Summary

The system uses **3 roles**:

### Coach-Admin (Full Site Access)
1. Login with **email + password**
2. Full access to all tabs and features
3. Role: `coach-admin` in `user_roles` table
4. Can manage all data, settings, and user roles

### Ride Leader (Coach Assignments Tab Only)
1. Login with **phone number + SMS code** OR **email + password**
2. System verifies phone/email exists in `coaches` table
3. If using phone: SMS code sent to phone (via Twilio), enter code to authenticate
4. If using email: Standard email/password authentication
5. Access limited to **"Coach Assignments"** tab only
6. Role: `ride_leader` in `user_roles` table
7. Session persists on device (can choose "Remember Me" for mobile devices)

### Rider (Rider Assignments Tab Only)
1. Login with **phone number + SMS code** OR **email + password**
2. System verifies phone/email exists in `riders` table
3. If using phone: SMS code sent to phone (via Twilio), enter code to authenticate
4. If using email: Standard email/password authentication
5. Access limited to **"Rider Assignments"** tab only
6. Role: `rider` in `user_roles` table
7. Session persists on device (can choose "Remember Me" for mobile devices)

**Note**: Supabase sessions persist by default, so users remain logged in on their device until they explicitly log out. For mobile devices, this provides a "remember me" experience automatically.

---

## Important Notes & Limitations

### Phone Authentication Considerations

⚠️ **Supabase Phone Auth Limitation**: Supabase's phone authentication uses phone numbers as the primary identifier. This means:

1. **Phone numbers must be unique** - Each phone can only be linked to one auth user
2. **Phone format matters** - Use consistent format (e.g., E.164: +14155551234)
3. **SMS Provider Required** - You need Twilio or similar for production SMS

### Recommended Approach

For the phone authentication flow, we'll implement:
1. **Custom verification step**: Check phone exists in DB before sending OTP
2. **Auto-create auth users**: When phone auth succeeds, create user_roles entry automatically
3. **Role assignment**: Assign role based on which table (coaches/riders) the phone matched

This requires a Supabase Edge Function (see implementation guide).

---

## Next Steps

1. ✅ Complete Supabase project setup (Steps 1-2)
2. ✅ Run database schema (Step 3)
3. ✅ Export and migrate data (Step 4)
4. ⏭️ Update application code for Supabase integration
5. ⏭️ Implement phone authentication flow
6. ⏭️ Test authentication flows
7. ⏭️ Deploy to GitHub Pages
8. ⏭️ Connect custom domain

---

## Troubleshooting

### Common Issues

**Issue**: "Invalid API key"
- **Solution**: Check `supabase-config.js` has correct URL and anon key

**Issue**: "Phone authentication not working"
- **Solution**: Ensure phone provider (Twilio) is configured in Supabase

**Issue**: "RLS policy violation"
- **Solution**: Check user_roles table has correct entry for your user

**Issue**: "Redirect URL mismatch"
- **Solution**: Add your URL to Supabase redirect URLs list

For more troubleshooting, see `docs/troubleshooting/` folder.

