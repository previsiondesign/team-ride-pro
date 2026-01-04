# Authentication Implementation Details

This document explains how the authentication system works and addresses the specific requirements for admin coaches, non-admin coaches, and riders.

## Authentication Requirements Summary

1. **Coach-Admin**: Email + Password → Full site access
2. **Ride Leader**: Phone + SMS Code OR Email + Password → "Coach Assignments" tab only
3. **Rider**: Phone + SMS Code OR Email + Password → "Rider Assignments" tab only

**Note**: Ride leaders and riders can choose phone OR email authentication. Sessions persist automatically on devices (Supabase default behavior provides "remember me" functionality).

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

### Coach-Admin Login Flow

```
User enters email + password
    ↓
Supabase email auth
    ↓
Success → Load user_roles
    ↓
Check role = 'coach-admin'
    ↓
Grant full access (all tabs)
```

### Ride Leader Login Flow (Phone Option)

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
Auto-create user_roles entry (role = 'ride_leader')
    ↓
Grant access to "Coach Assignments" tab only
    ↓
Session persists on device (automatic "remember me")
```

### Ride Leader Login Flow (Email Option)

```
User enters email + password
    ↓
Supabase email auth
    ↓
Verify email exists in coaches table (or allow admin-created accounts)
    ↓
Success → Load/create user_roles
    ↓
Check/assign role = 'ride_leader'
    ↓
Grant access to "Coach Assignments" tab only
    ↓
Session persists on device (automatic "remember me")
```

### Rider Login Flow (Phone Option)

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
    ↓
Session persists on device (automatic "remember me")
```

### Rider Login Flow (Email Option)

```
User enters email + password
    ↓
Supabase email auth
    ↓
Verify email exists in riders table (or allow admin-created accounts)
    ↓
Success → Load/create user_roles
    ↓
Check/assign role = 'rider'
    ↓
Grant access to "Rider Assignments" tab only
    ↓
Session persists on device (automatic "remember me")
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

