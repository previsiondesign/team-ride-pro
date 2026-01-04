# Team Ride Pro - Complete Supabase Integration Guide

**Version:** 1.0  
**Date:** December 2024  
**Purpose:** Complete step-by-step guide for integrating Team Ride Pro with Supabase

---

# Table of Contents

1. [Quick Start Guide](#1-quick-start-guide)
2. [Complete Setup Guide](#2-complete-setup-guide)
3. [Authentication Feasibility Analysis](#3-authentication-feasibility-analysis)
4. [Authentication Implementation Details](#4-authentication-implementation-details)
5. [Data Migration Guide](#5-data-migration-guide)
6. [Deployment Guide](#6-deployment-guide)

---

# 1. Quick Start Guide

This is your starting point for integrating Supabase with Team Ride Pro.

## ✅ Authentication Requirements - CONFIRMED POSSIBLE

All your authentication requirements are feasible with Supabase:

1. ✅ **Admin Coaches**: Email/Password → Full site access
2. ✅ **Non-Admin Coaches**: Phone + SMS code → "Coach Assignments" tab only  
3. ✅ **Riders**: Phone + SMS code → "Rider Assignments" tab only

## 📚 Documentation Overview

We've created comprehensive guides for you:

### 1. **COMPLETE_SETUP_GUIDE.md** ⭐ START HERE
   - Step-by-step Supabase project setup
   - Database schema installation
   - Authentication configuration
   - Initial configuration

### 2. **AUTHENTICATION_FEASIBILITY.md**
   - Confirms all requirements are possible
   - Explains implementation approach
   - Cost estimates
   - Timeline estimates

### 3. **AUTHENTICATION_IMPLEMENTATION.md**
   - Detailed authentication flow diagrams
   - Implementation details for each user type
   - Edge Functions needed
   - Frontend changes required

### 4. **MIGRATION_SCRIPT.md**
   - How to export current localStorage data
   - Script to migrate data to Supabase
   - Post-migration verification
   - Troubleshooting

### 5. **DEPLOYMENT_GUIDE.md**
   - GitHub Pages setup
   - Connecting custom domain (teamridepro.com)
   - Production configuration
   - SSL/HTTPS setup

### 6. **SQL Files**
   - `sql/database-schema.sql` - Main database schema (run first)
   - `sql/ADD_PHONE_AUTH_SUPPORT.sql` - Phone auth additions (run second)

## 🚀 Recommended Implementation Order

### Phase 1: Setup (Day 1) ⏱️ ~2-3 hours
1. ✅ Create Supabase project
2. ✅ Run database schema SQL
3. ✅ Configure email authentication
4. ✅ Get API credentials
5. ✅ Update `scripts/supabase-config.js`

### Phase 2: Admin Coaches (Day 2) ⏱️ ~2 hours
1. ✅ Create first admin account
2. ✅ Test email/password login
3. ✅ Verify full access works
4. ✅ Test data loading/saving

### Phase 3: Data Migration (Day 3) ⏱️ ~1-2 hours
1. ✅ Export localStorage data
2. ✅ Run migration script
3. ✅ Verify all data migrated
4. ✅ Normalize phone numbers

### Phase 4: Phone Auth Infrastructure (Day 4-5) ⏱️ ~4-6 hours
1. ✅ Set up Twilio account
2. ✅ Configure SMS in Supabase
3. ✅ Create phone verification Edge Function
4. ✅ Test phone auth flow

### Phase 5: Non-Admin Coaches (Day 6) ⏱️ ~3-4 hours
1. ✅ Implement phone login for coaches
2. ✅ Auto-create user_roles entries
3. ✅ Restrict to "Coach Assignments" tab
4. ✅ Test with real coach account

### Phase 6: Riders (Day 7) ⏱️ ~2-3 hours
1. ✅ Adapt phone login for riders
2. ✅ Restrict to "Rider Assignments" tab
3. ✅ Test with real rider account

### Phase 7: Deployment (Day 8) ⏱️ ~2-3 hours
1. ✅ Deploy to GitHub Pages
2. ✅ Test on production URL
3. ✅ Connect custom domain
4. ✅ Final testing

**Total Estimated Time**: 1-2 weeks (depending on experience level)

## 🎯 Getting Started Right Now

### Step 1: Read the Setup Guide
Open the Complete Setup Guide section and follow Steps 1-3:
- Create Supabase project
- Configure authentication
- Run database schema

### Step 2: Get Your Credentials
From Supabase Dashboard:
- Copy your Project URL
- Copy your anon key
- Update `scripts/supabase-config.js`

### Step 3: Run Database Schema
1. Open `sql/database-schema.sql`
2. Copy contents
3. Paste into Supabase SQL Editor
4. Click "Run"

### Step 4: Run Phone Auth Support SQL
1. Open `sql/ADD_PHONE_AUTH_SUPPORT.sql`
2. Copy contents
3. Paste into Supabase SQL Editor
4. Click "Run"

### Step 5: Create First Admin Account
Follow the Complete Setup Guide Step 4.3

## ⚠️ Important Notes

### Phone Authentication
- Requires SMS provider (Twilio recommended)
- Costs ~$0.0075 per SMS
- Free trial available ($15.50 credit)
- Phone numbers must be in E.164 format (+14155551234)

### Security
- Supabase `anon` key is meant to be public
- Security comes from Row Level Security (RLS) policies
- Already configured in database schema
- Admin keys should NEVER be exposed

### Data Migration
- IDs will change (localStorage IDs vs database IDs)
- Rides may need reassignment after migration
- Always backup before migrating
- Test migration on copy first (if possible)

### Domain Setup
- Can start with GitHub Pages (free)
- Custom domain can be added later
- DNS changes can take 24-48 hours
- SSL is automatic with GitHub/Netlify/Vercel

## 📋 Quick Checklist

Before you start:
- [ ] Supabase account created
- [ ] Read Complete Setup Guide
- [ ] Understand authentication requirements
- [ ] Have backup of current localStorage data
- [ ] Have admin coach email/password ready
- [ ] Understand phone numbers need to be in E.164 format

Ready to start:
- [ ] Create Supabase project
- [ ] Run database schema
- [ ] Run phone auth support SQL
- [ ] Get API credentials
- [ ] Update supabase-config.js
- [ ] Create admin account
- [ ] Test admin login

---

# 2. Complete Setup Guide

This guide will walk you through setting up Supabase for Team Ride Pro, including authentication, database setup, and data migration.

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

## 2. Authentication Configuration

### Step 2.1: Enable Phone Authentication
1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **"Phone"** in the list
3. Toggle it **ON**
4. **Important**: Phone authentication requires a third-party SMS provider (Twilio, MessageBird, etc.)
   - For testing/development, you can use Supabase's test mode (limited functionality)
   - For production, you'll need to set up Twilio (see Twilio Setup section)

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

### Step 3.4: Add Admin Role to user_roles Table

We need to distinguish between admin coaches and regular coaches. Update the user_roles table:

```sql
-- Update user_roles to support admin coaches
ALTER TABLE user_roles 
ALTER COLUMN role TYPE TEXT;

-- Remove the constraint and add a new one that includes 'admin'
DROP POLICY IF EXISTS "Coaches can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Coaches can update user roles" ON user_roles;

-- Recreate constraint with admin role
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('admin', 'coach', 'ride_leader', 'rider'));

-- Update RLS policies to allow admins (admins have coach privileges + more)
CREATE POLICY "Admins and coaches can view all user roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'coach')
        )
    );

CREATE POLICY "Admins and coaches can insert user roles" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'coach')
        )
    );

CREATE POLICY "Admins and coaches can update user roles" ON user_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'coach')
        )
    );
```

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

See the Data Migration Guide section for the complete migration script.

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

### Step 4.3: Create First Admin Coach Account

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Fill in:
   - **Email**: Your admin email
   - **Password**: Strong password
   - **Auto Confirm User**: Check this (or confirm via email)
4. Click **"Create user"**
5. Copy the **User UID** (UUID format)
6. Go to **SQL Editor** and run:

```sql
-- Replace USER_UUID_HERE with the UUID from step 5
-- Replace COACH_ID_HERE with the ID of your coach record
INSERT INTO user_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Link the auth user to your coach record
UPDATE coaches 
SET user_id = 'USER_UUID_HERE'
WHERE id = COACH_ID_HERE;
```

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

## Authentication Flow Summary

### Admin Coaches
1. Login with **email + password**
2. Full access to all tabs and features
3. Role: `admin` in `user_roles` table

### Non-Admin Coaches
1. Enter **phone number** on login screen
2. System verifies phone exists in `coaches` table
3. SMS code sent to phone (via Twilio)
4. Enter code to authenticate
5. Access limited to **"Coach Assignments"** tab only
6. Role: `coach` in `user_roles` table

### Riders
1. Enter **phone number** on login screen
2. System verifies phone exists in `riders` table
3. SMS code sent to phone (via Twilio)
4. Enter code to authenticate
5. Access limited to **"Rider Assignments"** tab only
6. Role: `rider` in `user_roles` table

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

---

# 3. Authentication Feasibility Analysis

## Your Requirements Summary

1. **Admin Coaches**: Email/Password login → Full site access
2. **Non-Admin Coaches**: Phone + SMS code → "Coach Assignments" tab only
3. **Riders**: Phone + SMS code → "Rider Assignments" tab only

## ✅ Confirmation: YES, This is Possible with Supabase

All three authentication methods are feasible with Supabase, though phone authentication requires some custom implementation.

## Detailed Feasibility

### 1. Admin Coaches (Email/Password) ✅ **FULLY SUPPORTED**

**Status**: ✅ Native Supabase feature - no custom code needed

**Implementation**:
- Use Supabase's built-in email/password authentication
- Assign role `'admin'` in `user_roles` table
- Check role in frontend to grant full access

**Requirements**:
- Supabase project with email auth enabled (default)
- User account created in Supabase Auth
- Entry in `user_roles` table with `role = 'admin'`

**Effort**: ⭐ Easy (1-2 hours)

### 2. Non-Admin Coaches (Phone + SMS) ⚠️ **SUPPORTED WITH CUSTOM FLOW**

**Status**: ✅ Possible, requires custom implementation

**Implementation Approach**:

**Option A: Pre-validation + Supabase Phone Auth** (Recommended)
1. User enters phone number
2. Frontend calls Edge Function to verify phone exists in `coaches` table
3. If valid, initiate Supabase phone auth (sends OTP)
4. User enters OTP code
5. After successful auth, auto-create `user_roles` entry with `role = 'coach'`
6. Frontend restricts access to "Coach Assignments" tab only

**Requirements**:
- Supabase phone auth enabled
- SMS provider configured (Twilio recommended)
- Edge Function for phone verification
- Database trigger or Edge Function hook to create user_roles after phone auth
- Frontend role-based access control

**Limitations**:
- Phone numbers must be unique (one phone = one auth user)
- Phone numbers must match exactly in `coaches` table
- Requires SMS provider (costs money for production)

**Effort**: ⭐⭐⭐ Moderate (4-8 hours)

**Alternative: Simplified Approach** (Less Secure)
- Allow any phone number to attempt auth
- After successful phone auth, check if phone exists in coaches table
- If no match, sign out user immediately
- If match, create user_roles entry

**Effort**: ⭐⭐ Easier (2-4 hours) but wastes SMS credits

### 3. Riders (Phone + SMS) ⚠️ **SUPPORTED WITH CUSTOM FLOW**

**Status**: ✅ Same as non-admin coaches

**Implementation**: Identical to non-admin coaches, but:
- Verify phone exists in `riders` table instead of `coaches`
- Assign `role = 'rider'` in user_roles
- Restrict access to "Rider Assignments" tab only

**Effort**: ⭐⭐⭐ Moderate (4-8 hours, or shared with coaches implementation)

## Implementation Strategy

### Recommended Approach: Phased Implementation

**Phase 1: Admin Coaches (Email/Password)** ⏱️ ~2 hours
- Set up email authentication
- Create admin account
- Implement role checking
- Test admin login and full access

**Phase 2: Phone Authentication Infrastructure** ⏱️ ~4 hours
- Configure Twilio/SMS provider
- Enable Supabase phone auth
- Create phone verification Edge Function
- Test phone auth flow

**Phase 3: Non-Admin Coaches** ⏱️ ~3 hours
- Implement phone verification for coaches
- Auto-create user_roles for coaches
- Implement "Coach Assignments" tab restriction
- Test coach login flow

**Phase 4: Riders** ⏱️ ~2 hours (reuse coach implementation)
- Adapt phone verification for riders
- Auto-create user_roles for riders
- Implement "Rider Assignments" tab restriction
- Test rider login flow

**Total Estimated Time**: 11-15 hours

## Potential Issues & Solutions

### Issue 1: Phone Number Format Mismatch
**Problem**: Phone numbers stored differently in DB vs. entered by user
**Solution**: Normalize all phone numbers to E.164 format (+14155551234) before storage and comparison

### Issue 2: SMS Costs
**Problem**: Twilio charges per SMS (varies by country, ~$0.0075 per SMS in US)
**Solution**: 
- Use Twilio free trial for testing ($15.50 credit)
- For production, budget ~$10-50/month depending on usage
- Consider alternative: Email OTP for non-critical users

### Issue 3: Phone Number Already Used
**Problem**: Someone tries to register with a phone number that's already an auth user
**Solution**: 
- Supabase phone auth handles this automatically (signs in existing user)
- Ensure phone numbers are unique in coaches/riders tables
- If duplicate, use password reset flow instead

### Issue 4: No Matching Phone Number
**Problem**: User enters phone number that doesn't exist in coaches/riders table
**Solution**: 
- Edge Function returns error before sending OTP (saves SMS cost)
- Show user-friendly error message
- Admin can add phone number to appropriate table

## SMS Provider Options

### Twilio (Recommended)
- **Cost**: ~$0.0075 per SMS (US)
- **Free Trial**: $15.50 credit
- **Setup**: Easy, well-documented
- **Integration**: Native Supabase support

### MessageBird
- **Cost**: Similar to Twilio
- **Setup**: Moderate
- **Integration**: Requires custom implementation

### Vonage (formerly Nexmo)
- **Cost**: Similar to Twilio
- **Setup**: Moderate
- **Integration**: Requires custom implementation

**Recommendation**: Use Twilio - it's the easiest and most reliable option.

## Cost Estimate

### Supabase
- **Free Tier**: Includes phone auth, 50,000 monthly active users
- **Cost**: $0/month for your use case (unless you exceed free tier limits)

### Twilio (SMS)
- **Free Trial**: $15.50 credit (~2,000 SMS)
- **Production**: ~$0.0075 per SMS
- **Monthly Estimate**: 
  - 50 coaches × 10 logins/month = 500 SMS = ~$3.75/month
  - 100 riders × 5 logins/month = 500 SMS = ~$3.75/month
  - **Total**: ~$7.50/month for 1,000 SMS

**Annual SMS Cost**: ~$90/year (very affordable)

## Final Recommendation

✅ **YES, proceed with Supabase**

Your authentication requirements are all feasible:
1. ✅ Admin coaches (email/password) - native feature
2. ✅ Non-admin coaches (phone/SMS) - requires custom flow but well-supported
3. ✅ Riders (phone/SMS) - same as coaches

**Suggested Implementation Order**:
1. Start with admin coaches (quick win)
2. Then implement phone auth infrastructure
3. Add non-admin coaches
4. Finally add riders (reuse coach implementation)

**Estimated Timeline**: 
- Full implementation: 1-2 weeks (depending on experience)
- Admin coaches only: 1 day
- Phone auth for all users: 1 week

---

# 4. Authentication Implementation Details

This document explains how the authentication system works and addresses the specific requirements for admin coaches, non-admin coaches, and riders.

## Authentication Requirements Summary

1. **Admin Coaches**: Email + Password → Full site access
2. **Non-Admin Coaches**: Phone + SMS Code → "Coach Assignments" tab only
3. **Riders**: Phone + SMS Code → "Rider Assignments" tab only

## Implementation Approach

### Challenge: Supabase Phone Auth Limitations

Supabase's phone authentication has these characteristics:
- Uses phone number as the primary identifier (like email for email auth)
- Automatically creates auth users when phone auth succeeds
- Requires phone numbers to be unique across all users
- Requires an SMS provider (Twilio, MessageBird, etc.)

### Solution: Hybrid Approach with Edge Function

We'll implement a custom flow that:
1. Validates phone numbers against existing records BEFORE authentication
2. Uses Supabase's phone auth for OTP delivery
3. Auto-creates user_roles entries after successful phone auth
4. Assigns appropriate role based on phone match (coach vs rider)

## Detailed Flow Diagrams

### Admin Coach Login Flow

```
User enters email + password
    ↓
Supabase email auth
    ↓
Success → Load user_roles
    ↓
Check role = 'admin'
    ↓
Grant full access
```

### Non-Admin Coach Login Flow

```
User enters phone number
    ↓
Call Edge Function: verify-phone
    ↓
Check if phone exists in coaches table
    ↓
If YES:
    Send OTP via Supabase phone auth
    ↓
User enters OTP code
    ↓
Verify OTP with Supabase
    ↓
Create/link auth user
    ↓
Auto-create user_roles entry (role = 'coach')
    ↓
Grant access to "Coach Assignments" tab only
```

### Rider Login Flow

```
User enters phone number
    ↓
Call Edge Function: verify-phone
    ↓
Check if phone exists in riders table
    ↓
If YES:
    Send OTP via Supabase phone auth
    ↓
User enters OTP code
    ↓
Verify OTP with Supabase
    ↓
Create/link auth user
    ↓
Auto-create user_roles entry (role = 'rider')
    ↓
Grant access to "Rider Assignments" tab only
```

## Edge Function: Phone Verification

We need a Supabase Edge Function to verify phone numbers before sending OTP.

**Location**: `supabase/functions/verify-phone/index.ts`

**Purpose**: 
- Verify phone number exists in coaches or riders table
- Return which table it exists in
- This prevents unauthorized phone numbers from receiving OTP codes

**Implementation**: See Edge Function implementation guide (to be created)

## Database Changes Required

### 1. Phone Verification Function

Already added in Step 3.3 of the setup guide - this allows checking if a phone exists without exposing full records.

### 2. Auto-Create User Roles Trigger

We need a database trigger or Edge Function hook to automatically create user_roles entries when:
- A phone auth user is created
- The phone matches a coach or rider record

**Option A: Database Trigger** (Simpler)
```sql
-- Function to auto-create user_roles after phone auth
CREATE OR REPLACE FUNCTION handle_new_phone_user()
RETURNS TRIGGER AS $$
DECLARE
    coach_record coaches;
    rider_record riders;
BEGIN
    -- Check if phone matches a coach
    SELECT * INTO coach_record FROM coaches WHERE phone = NEW.phone LIMIT 1;
    
    IF coach_record IS NOT NULL THEN
        -- Create coach role
        INSERT INTO user_roles (user_id, role)
        VALUES (NEW.id, 'coach')
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Link coach record to auth user
        UPDATE coaches SET user_id = NEW.id WHERE id = coach_record.id;
        RETURN NEW;
    END IF;
    
    -- Check if phone matches a rider
    SELECT * INTO rider_record FROM riders WHERE phone = NEW.phone LIMIT 1;
    
    IF rider_record IS NOT NULL THEN
        -- Create rider role
        INSERT INTO user_roles (user_id, role)
        VALUES (NEW.id, 'rider')
        ON CONFLICT (user_id) DO NOTHING;
        RETURN NEW;
    END IF;
    
    -- No match found - user will have no role (cannot access app)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger approach has limitations because Supabase auth.users
-- table is not directly accessible. We'll use an Edge Function instead.
```

**Option B: Edge Function Hook** (Recommended)

Use a Supabase Auth Webhook or Edge Function triggered after user creation to:
1. Get the new user's phone number
2. Check coaches/riders tables
3. Create appropriate user_roles entry

### 3. Phone Number Format Standardization

**Critical**: Phone numbers must be stored in consistent format (E.164 recommended: +14155551234)

Add a migration to normalize existing phone numbers:

```sql
-- Normalize phone numbers to E.164 format
-- This is a helper function - run manually or via migration script
UPDATE coaches 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone NOT LIKE '+%';

UPDATE riders 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone NOT LIKE '+%';
```

## Frontend Implementation

### Login UI Changes

The login UI needs to support three authentication methods:

1. **Email/Password Form** (for admin coaches)
2. **Phone Number Input** (for non-admin coaches and riders)
3. **OTP Code Input** (appears after phone submission)

### Auth State Management

Update `scripts/auth.js` to include:
- `signInWithPhone(phoneNumber)` - Initiate phone auth
- `verifyPhoneOTP(phoneNumber, otp)` - Verify OTP code
- `verifyPhoneExists(phoneNumber)` - Check phone in DB (via Edge Function)

### Role-Based Access Control

Update `scripts/roles.js` to check:
- `isAdmin()` - Returns true if role = 'admin'
- `isCoach()` - Returns true if role = 'coach' or 'admin'
- `isRider()` - Returns true if role = 'rider'

Update tab visibility in main app:
- Admin: All tabs visible
- Coach: Only "Coach Assignments" tab
- Rider: Only "Rider Assignments" tab

## Twilio Setup for SMS

### Step 1: Create Twilio Account
1. Go to https://www.twilio.com
2. Sign up for free trial (includes $15.50 credit)
3. Verify your phone number

### Step 2: Get Credentials
1. In Twilio Console → Settings → General
2. Copy:
   - **Account SID**
   - **Auth Token**

### Step 3: Get Phone Number
1. In Twilio Console → Phone Numbers → Manage → Buy a number
2. Select a number with SMS capability
3. Note the phone number

### Step 4: Configure in Supabase
1. In Supabase Dashboard → Authentication → Providers → Phone
2. Enter:
   - **Twilio Account SID**
   - **Twilio Auth Token**
   - **Twilio Phone Number**
3. Save

**Note**: Free tier has limits. For production, consider upgrading Twilio plan.

## Alternative: Use Supabase's Built-in Phone Auth (Simpler)

If the Edge Function approach is too complex, we can use Supabase's phone auth directly:

1. Allow anyone to sign up with phone number
2. After successful phone auth, check if phone exists in coaches/riders
3. If yes, create user_roles entry
4. If no, sign out user and show error

**Limitations**:
- Users can attempt auth with any phone number
- OTP will be sent even if phone doesn't exist in system
- Requires handling failed auth after OTP verification

**Pros**: Simpler implementation, no Edge Function needed
**Cons**: Wastes SMS credits, less secure

## Recommended Implementation Order

1. ✅ Set up Supabase project and database
2. ✅ Configure email auth (for admin coaches)
3. ✅ Configure phone auth provider (Twilio)
4. ⏭️ Implement admin coach login (email/password)
5. ⏭️ Implement phone verification Edge Function
6. ⏭️ Implement phone auth flow for coaches/riders
7. ⏭️ Implement role-based access control
8. ⏭️ Test all authentication flows
9. ⏭️ Deploy and configure production URLs

## Testing Checklist

- [ ] Admin coach can login with email/password
- [ ] Admin coach has full access to all tabs
- [ ] Non-admin coach can login with phone number
- [ ] OTP code is received via SMS
- [ ] Non-admin coach can verify OTP
- [ ] Non-admin coach only sees "Coach Assignments" tab
- [ ] Rider can login with phone number
- [ ] Rider only sees "Rider Assignments" tab
- [ ] Invalid phone numbers are rejected
- [ ] Users without matching phone numbers cannot access app
- [ ] Role changes are reflected immediately after login
- [ ] Logout works correctly
- [ ] Session persists across page refreshes

---

# 5. Data Migration Guide

This guide explains how to migrate your existing localStorage data to Supabase.

## Pre-Migration Checklist

- [ ] Supabase project is set up
- [ ] Database schema has been run (see Complete Setup Guide Step 3)
- [ ] You have exported your localStorage data (backup)
- [ ] You have your Supabase project URL and anon key

## Migration Options

### Option 1: Browser Console Script (Recommended)

This script runs in your browser console and migrates data directly to Supabase.

1. Open your application in the browser
2. Open Developer Console (F12)
3. Make sure Supabase is configured in `scripts/supabase-config.js`
4. Paste and run this script:

```javascript
// ============================================
// Team Ride Pro - Data Migration Script
// ============================================

async function migrateToSupabase() {
    console.log('Starting migration to Supabase...');
    
    // Load data from localStorage
    const localData = JSON.parse(localStorage.getItem('teamRideProData') || '{}');
    
    if (!localData.riders && !localData.coaches) {
        console.error('No data found in localStorage');
        return;
    }
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('Supabase client not initialized. Check supabase-config.js');
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Migrate Riders
    if (localData.riders && localData.riders.length > 0) {
        console.log(`Migrating ${localData.riders.length} riders...`);
        for (const rider of localData.riders) {
            try {
                const dbData = {
                    name: rider.name || '',
                    phone: rider.phone || null,
                    email: rider.email || null,
                    grade: rider.grade || null,
                    gender: rider.gender || null,
                    racing_group: rider.racingGroup || rider.racing_group || null,
                    fitness: rider.fitness || '5',
                    photo: rider.photo || null,
                    notes: rider.notes || null
                };
                
                const { data, error } = await client
                    .from('riders')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating rider ${rider.name}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated rider: ${rider.name} (old ID: ${rider.id}, new ID: ${data.id})`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating rider ${rider.name}:`, err);
                errorCount++;
            }
        }
    }
    
    // Migrate Coaches
    if (localData.coaches && localData.coaches.length > 0) {
        console.log(`Migrating ${localData.coaches.length} coaches...`);
        for (const coach of localData.coaches) {
            try {
                const dbData = {
                    name: coach.name || '',
                    phone: coach.phone || null,
                    email: coach.email || null,
                    level: coach.level || '1',
                    fitness: coach.fitness || '5',
                    photo: coach.photo || null,
                    notes: coach.notes || null,
                    user_id: null // Will be linked later if they have auth account
                };
                
                const { data, error } = await client
                    .from('coaches')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating coach ${coach.name}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated coach: ${coach.name} (old ID: ${coach.id}, new ID: ${data.id})`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating coach ${coach.name}:`, err);
                errorCount++;
            }
        }
    }
    
    // Migrate Routes
    if (localData.routes && localData.routes.length > 0) {
        console.log(`Migrating ${localData.routes.length} routes...`);
        for (const route of localData.routes) {
            try {
                const dbData = {
                    name: route.name || '',
                    description: route.description || null,
                    strava_embed_code: route.stravaEmbedCode || route.strava_embed_code || null
                };
                
                const { data, error } = await client
                    .from('routes')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating route ${route.name}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated route: ${route.name}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating route ${route.name}:`, err);
                errorCount++;
            }
        }
    }
    
    // Migrate Season Settings
    if (localData.seasonSettings) {
        console.log('Migrating season settings...');
        try {
            const settingsData = {
                id: 'current',
                start_date: localData.seasonSettings.startDate || null,
                end_date: localData.seasonSettings.endDate || null,
                practices: localData.seasonSettings.practices || []
            };
            
            const { data, error } = await client
                .from('season_settings')
                .upsert([settingsData], { onConflict: 'id' })
                .select()
                .single();
            
            if (error) {
                console.error('Error migrating season settings:', error);
                errorCount++;
            } else {
                console.log('✓ Migrated season settings');
                successCount++;
            }
        } catch (err) {
            console.error('Error migrating season settings:', err);
            errorCount++;
        }
    }
    
    // Migrate Auto Assign Settings
    if (localData.autoAssignSettings && localData.autoAssignSettings.parameters) {
        console.log('Migrating auto assign settings...');
        try {
            const settingsData = {
                id: 'current',
                parameters: localData.autoAssignSettings.parameters || []
            };
            
            const { data, error } = await client
                .from('auto_assign_settings')
                .upsert([settingsData], { onConflict: 'id' })
                .select()
                .single();
            
            if (error) {
                console.error('Error migrating auto assign settings:', error);
                errorCount++;
            } else {
                console.log('✓ Migrated auto assign settings');
                successCount++;
            }
        } catch (err) {
            console.error('Error migrating auto assign settings:', err);
            errorCount++;
        }
    }
    
    // Migrate Rides (More complex - includes groups and assignments)
    if (localData.rides && localData.rides.length > 0) {
        console.log(`Migrating ${localData.rides.length} rides...`);
        for (const ride of localData.rides) {
            try {
                const dbData = {
                    date: ride.date || null,
                    available_coaches: ride.availableCoaches || ride.available_coaches || [],
                    available_riders: ride.availableRiders || ride.available_riders || [],
                    assignments: ride.assignments || {},
                    groups: ride.groups || [],
                    cancelled: ride.cancelled || false,
                    published_groups: ride.publishedGroups || ride.published_groups || false
                };
                
                const { data, error } = await client
                    .from('rides')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating ride ${ride.date}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated ride: ${ride.date}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating ride ${ride.date}:`, err);
                errorCount++;
            }
        }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('\nNote: Rider/Coach IDs have changed. Rides reference old IDs.');
    console.log('You may need to update ride assignments manually or run ID mapping script.');
}

// Run migration
migrateToSupabase();
```

### Option 2: Export/Import via CSV (For Large Datasets)

If you have CSV exports of riders/coaches:

1. Go to Supabase Dashboard → Table Editor
2. Select the table (riders or coaches)
3. Click "Insert row" → "Import data via CSV"
4. Upload your CSV file
5. Map columns correctly

**Note**: This method doesn't preserve IDs and won't migrate rides/settings.

### Option 3: SQL Import (Advanced)

For advanced users familiar with SQL:

1. Export your data to JSON (using Option 1 script but with console.log output)
2. Convert JSON to SQL INSERT statements
3. Run SQL in Supabase SQL Editor

## Post-Migration Tasks

### 1. Verify Data

Check that all data was migrated:

```javascript
// Verification script - run in browser console
async function verifyMigration() {
    const client = getSupabaseClient();
    
    const { data: riders } = await client.from('riders').select('count');
    const { data: coaches } = await client.from('coaches').select('count');
    const { data: rides } = await client.from('rides').select('count');
    
    console.log('Migrated counts:');
    console.log(`Riders: ${riders?.length || 0}`);
    console.log(`Coaches: ${coaches?.length || 0}`);
    console.log(`Rides: ${rides?.length || 0}`);
}

verifyMigration();
```

### 2. Create Admin Coach Account

See Complete Setup Guide Step 4.3 for instructions on creating your first admin account.

### 3. Normalize Phone Numbers

Ensure all phone numbers are in consistent format (E.164):

```sql
-- Run in Supabase SQL Editor
UPDATE coaches 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;

UPDATE riders 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;
```

### 4. Handle ID Mapping (If Needed)

**Important**: If your rides reference rider/coach IDs, those IDs will have changed after migration.

You have two options:

**Option A**: Re-run assignments (recommended)
- The application will re-assign riders/coaches to rides based on availability
- Old assignments may need to be recreated

**Option B**: Create ID mapping and update rides
- Create a mapping of old IDs → new IDs
- Update ride.available_coaches and ride.available_riders arrays
- This is complex and error-prone

## Troubleshooting

### "RLS policy violation" errors

This means your user doesn't have proper permissions. Ensure:
1. You've created an admin user account
2. The user_roles table has an entry for your user
3. The role is set to 'admin' or 'coach'

### "Duplicate key" errors

Data already exists in the database. Options:
1. Clear existing data (dangerous - backup first!)
2. Skip duplicates (modify script to check before insert)
3. Use upsert instead of insert

### Phone number format issues

Phone numbers must be consistent. Run the normalization SQL (see Post-Migration Task #3).

### Migration partially complete

If migration stops partway:
1. Check console for error messages
2. Note which records succeeded/failed
3. Re-run script (it will try to insert duplicates)
4. Manually fix any errors

## Rolling Back

If you need to roll back:

1. **Delete all data** (dangerous - ensure you have backup!):

```sql
-- Run in Supabase SQL Editor - DELETES ALL DATA!
TRUNCATE TABLE rides, rider_availability, rider_feedback, ride_notes, 
              riders, coaches, routes, season_settings, auto_assign_settings, user_roles;
```

2. **Restore from backup**:
   - Your original localStorage backup is still in your browser
   - Or use the exported JSON file

3. **Start over** with migration script

---

# 6. Deployment Guide

This guide covers deploying your application and connecting it to your custom domain (teamridepro.com).

## Deployment Options

### Option 1: GitHub Pages (Recommended for Testing)

GitHub Pages is free and perfect for hosting static sites.

#### Step 1: Create GitHub Repository

1. Go to https://github.com and sign in
2. Click **"New repository"**
3. Repository name: `team-ride-pro` (or your preferred name)
4. Choose **Public** or **Private** (Public is free)
5. **Don't** initialize with README (we'll push existing code)
6. Click **"Create repository"**

#### Step 2: Push Your Code

If you don't have Git set up locally:

1. Install Git: https://git-scm.com/downloads
2. Open terminal/command prompt in your project folder
3. Run these commands:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Team Ride Pro"

# Add GitHub remote (replace USERNAME and REPO_NAME)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

#### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (in repository tabs)
3. Scroll to **Pages** (in left sidebar)
4. Under **Source**, select:
   - **Branch**: `main` (or `master`)
   - **Folder**: `/ (root)`
5. Click **Save**
6. Your site will be available at: `https://USERNAME.github.io/REPO_NAME`

#### Step 4: Update Supabase Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://USERNAME.github.io/REPO_NAME/**`
   - `https://USERNAME.github.io/REPO_NAME/teamridepro_v2.html`
3. Click **Save**

### Option 2: Netlify (Alternative)

Netlify offers automatic deployments and custom domains.

#### Step 1: Create Netlify Account

1. Go to https://www.netlify.com
2. Sign up (can use GitHub account)
3. Free tier includes custom domains

#### Step 2: Deploy Site

1. In Netlify dashboard, click **"Add new site"** → **"Import an existing project"**
2. Connect to GitHub repository (or drag & drop folder)
3. Configure build settings:
   - **Build command**: (leave empty - static site)
   - **Publish directory**: `/` (root)
4. Click **"Deploy site"**

#### Step 3: Configure Custom Domain

1. In site settings → **Domain management**
2. Click **"Add custom domain"**
3. Enter: `teamridepro.com`
4. Follow DNS configuration instructions

#### Step 4: Update Supabase Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://teamridepro.com/**`
   - `https://www.teamridepro.com/**` (if using www)
3. Click **Save**

### Option 3: Vercel (Alternative)

Similar to Netlify, good for static sites.

1. Go to https://vercel.com
2. Sign up and connect GitHub
3. Import repository
4. Deploy (auto-detects static site)
5. Configure custom domain in project settings

## Connecting Custom Domain (teamridepro.com)

Since your domain is registered through Wix, you have a few options:

### Option A: Use Wix DNS (Recommended if staying on Wix)

1. Log into Wix account
2. Go to **Domains** → **teamridepro.com**
3. Click **"Manage DNS"** or **"DNS Settings"**
4. Add/Edit DNS records:

#### For GitHub Pages:
- **Type**: CNAME
- **Name**: `@` or `www` (or both)
- **Value**: `USERNAME.github.io`
- **TTL**: 3600 (default)

#### For Netlify:
- **Type**: CNAME
- **Name**: `@`
- **Value**: `your-site-name.netlify.app`
- **TTL**: 3600

5. Save changes
6. Wait 24-48 hours for DNS propagation

### Option B: Transfer DNS to Hosting Provider

1. In Wix, find your domain's nameservers
2. Update nameservers at your hosting provider (GitHub/Netlify)
3. Let hosting provider manage DNS

**Note**: This gives hosting provider full control but is more flexible.

### Option C: Use Subdomain (Easiest)

If DNS changes are complicated, use a subdomain:

1. In Wix DNS, add:
   - **Type**: CNAME
   - **Name**: `app` (or `team` or `admin`)
   - **Value**: `USERNAME.github.io`
2. Access site at: `app.teamridepro.com`
3. Update Supabase redirect URLs to include subdomain

## Environment Variables (Production)

### Important: Secure Your API Keys

For production, you should NOT hardcode your Supabase keys in the JavaScript files.

### Option 1: Use Environment Variables (Netlify/Vercel)

If using Netlify or Vercel:

1. In site settings → **Environment variables**
2. Add:
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key`
3. Update `scripts/supabase-config.js` to read from environment:

```javascript
// Read from environment variables (set by hosting provider)
const SUPABASE_URL = window.SUPABASE_URL || 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your-anon-key';
```

### Option 2: Keep in Config File (GitHub Pages)

For GitHub Pages (static hosting), you have limited options:

1. **Keep keys in supabase-config.js** (less secure but acceptable for anon key)
2. **Use Supabase RLS policies** to protect data (recommended)
3. The anon key is meant to be public - security comes from RLS policies

**Note**: The Supabase `anon` key is designed to be public. Real security comes from Row Level Security (RLS) policies, which you've already set up.

## Production Checklist

Before going live:

### Security
- [ ] Supabase RLS policies are enabled and tested
- [ ] User roles are properly configured
- [ ] Admin accounts have strong passwords
- [ ] Phone authentication is configured with production SMS provider
- [ ] Email verification is enabled (optional but recommended)

### Configuration
- [ ] Supabase redirect URLs include production domain
- [ ] Site URL is set to production domain in Supabase
- [ ] Environment variables are set (if using)
- [ ] API keys are configured correctly

### Testing
- [ ] Admin login works (email/password)
- [ ] Coach login works (phone/SMS)
- [ ] Rider login works (phone/SMS)
- [ ] All tabs are accessible to appropriate users
- [ ] Data loads correctly from Supabase
- [ ] Data saves correctly to Supabase
- [ ] Logout works
- [ ] Session persists across page refreshes

### DNS
- [ ] Domain is pointing to hosting provider
- [ ] SSL certificate is active (automatic with GitHub/Netlify/Vercel)
- [ ] Both www and non-www work (or redirect configured)

### Backup
- [ ] Original localStorage data is backed up
- [ ] Database exports are scheduled (manual or automated)
- [ ] Supabase project has backups enabled (automatic on paid plans)

## Post-Deployment

### Monitor Usage

1. **Supabase Dashboard** → Monitor API usage, database size, auth usage
2. **Hosting Provider Dashboard** → Monitor bandwidth, visits
3. **Twilio Dashboard** → Monitor SMS usage and costs

### Set Up Monitoring (Optional)

- **Supabase**: Built-in dashboard shows errors and usage
- **Sentry**: Error tracking (free tier available)
- **Google Analytics**: User tracking (if desired)

### Cost Monitoring

- **Supabase Free Tier**: 50,000 monthly active users
- **Twilio**: ~$0.0075 per SMS
- **Hosting**: Free (GitHub Pages/Netlify/Vercel free tiers)
- **Total Estimated Cost**: ~$10-20/month (mostly SMS)

## Troubleshooting Deployment

### Issue: "Redirect URL mismatch"

**Solution**: 
- Check Supabase redirect URLs include your production domain
- Ensure URL format matches exactly (including https://)
- Wait a few minutes after updating (cache)

### Issue: "Site not loading"

**Solution**:
- Check DNS propagation (can take 24-48 hours)
- Verify CNAME/A records are correct
- Check hosting provider status page

### Issue: "API key errors"

**Solution**:
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check environment variables are set (if using)
- Ensure config file is loaded before other scripts

### Issue: "SSL certificate errors"

**Solution**:
- GitHub/Netlify/Vercel provide SSL automatically
- Wait a few minutes after DNS changes
- Clear browser cache
- Check certificate in browser developer tools

## Recommended Deployment Path

1. ✅ **Development**: Local testing with localhost
2. ✅ **Staging**: GitHub Pages with test URL (username.github.io)
3. ✅ **Production**: Custom domain (teamridepro.com)

Test thoroughly in staging before pointing custom domain to production.

---

# End of Guide

**Good luck with your Supabase integration!** 🚴‍♂️

For questions or issues, refer to the troubleshooting sections in each guide or check the Supabase documentation.

