# SMS/Email Verification Code Implementation Guide

This guide walks through adding verification codes to the simplified login flow for riders and coaches.

## Overview

The verification flow will work as follows:
1. User enters phone/email
2. System looks up user (existing `lookupUserByPhoneOrEmail` function)
3. If found, generate a 6-digit code and send via SMS (Twilio) or Email
4. User enters the code
5. System verifies the code
6. If valid, grant access (store in sessionStorage as before)

---

## Step 1: Create Database Table for Verification Codes

Create a new SQL migration file: `sql/ADD_VERIFICATION_CODES_TABLE.sql`

```sql
-- Create verification_codes table to store temporary verification codes
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_or_email TEXT NOT NULL,
    code TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'coach')),
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_email ON verification_codes(phone_or_email, code, verified);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert verification codes (for sending)
CREATE POLICY "Anyone can create verification codes" ON verification_codes
    FOR INSERT WITH CHECK (true);

-- Allow anonymous users to verify codes (for checking)
CREATE POLICY "Anyone can verify codes" ON verification_codes
    FOR SELECT USING (true);

-- Allow anonymous users to mark codes as verified
CREATE POLICY "Anyone can update verification codes" ON verification_codes
    FOR UPDATE USING (true);

-- Clean up old codes (run periodically via cron or Edge Function)
-- DELETE FROM verification_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
```

**Run this in Supabase SQL Editor**

---

## Step 2: Create Database Functions

Add these functions to `scripts/database.js`:

```javascript
// Generate a random 6-digit code
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a verification code in the database
async function createVerificationCode(phoneOrEmail, userType, userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not available');
    
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    
    const { data, error } = await client
        .from('verification_codes')
        .insert({
            phone_or_email: phoneOrEmail.trim(),
            code: code,
            user_type: userType,
            user_id: userId,
            expires_at: expiresAt.toISOString(),
            verified: false
        })
        .select()
        .single();
    
    if (error) throw error;
    return { code, id: data.id };
}

// Verify a code
async function verifyCode(phoneOrEmail, code) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not available');
    
    const { data, error } = await client
        .from('verification_codes')
        .select('*')
        .eq('phone_or_email', phoneOrEmail.trim())
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (error) throw error;
    
    if (!data) {
        return { valid: false, message: 'Invalid or expired code' };
    }
    
    // Mark code as verified
    await client
        .from('verification_codes')
        .update({ verified: true })
        .eq('id', data.id);
    
    return {
        valid: true,
        userType: data.user_type,
        userId: data.user_id
    };
}
```

---

## Step 3: Set Up Twilio for SMS (Optional - if using SMS)

### 3.1: Create Twilio Account
1. Go to https://www.twilio.com
2. Sign up for free trial (includes $15.50 credit)
3. Verify your phone number

### 3.2: Get Twilio Credentials
1. In Twilio Console → Settings → General
2. Copy:
   - **Account SID**
   - **Auth Token**
3. In Twilio Console → Phone Numbers → Manage → Buy a number
4. Select a number with SMS capability
5. Note the phone number

### 3.3: Configure in Supabase
1. In Supabase Dashboard → Authentication → Providers → Phone
2. Enter:
   - **Twilio Account SID**
   - **Twilio Auth Token**
   - **Twilio Phone Number**
3. Save

**OR** use Supabase Edge Function (see Step 4)

---

## Step 4: Create Supabase Edge Function for Sending Codes

### Option A: Use Supabase Edge Function (Recommended)

Create a new Edge Function: `supabase/functions/send-verification-code/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

serve(async (req) => {
  try {
    const { phoneOrEmail, code, isEmail } = await req.json()
    
    if (isEmail) {
      // Send email via Supabase's built-in email service
      // Or use a service like SendGrid, Resend, etc.
      // For now, we'll use a simple approach
      console.log(`Email verification code for ${phoneOrEmail}: ${code}`)
      // TODO: Implement email sending
      return new Response(JSON.stringify({ success: true, method: 'email' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      // Send SMS via Twilio
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        throw new Error('Twilio credentials not configured')
      }
      
      const message = `Your Tam High MTB Team verification code is: ${code}. Valid for 10 minutes.`
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: TWILIO_PHONE_NUMBER,
            To: phoneOrEmail,
            Body: message
          })
        }
      )
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Twilio error: ${error}`)
      }
      
      return new Response(JSON.stringify({ success: true, method: 'sms' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### Option B: Use Supabase's Built-in Email (Simpler for Email)

Supabase has built-in email sending. You can use it via:
- Supabase Dashboard → Settings → Auth → Email Templates
- Or use the `@supabase/auth-helpers` to send emails

---

## Step 5: Update UI to Show Verification Step

Update the simplified login form in `teamridepro_v2.html`:

1. **Add verification code input form** (after phone/email lookup)
2. **Update `handleSimplifiedLogin`** to send code instead of immediately logging in
3. **Add `handleVerifyCode`** function to verify the code

---

## Step 6: Update Simplified Login Flow

The flow will be:
1. User enters phone/email → `handleSimplifiedLogin()`
2. Lookup user → `lookupUserByPhoneOrEmail()`
3. If found, generate code → `createVerificationCode()`
4. Send code → Edge Function or email service
5. Show code input form
6. User enters code → `handleVerifyCode()`
7. Verify code → `verifyCode()`
8. If valid, store login info and redirect

---

## Step 7: Implementation Checklist

- [ ] Create `verification_codes` table in Supabase
- [ ] Add database functions to `scripts/database.js`
- [ ] Set up Twilio account (if using SMS)
- [ ] Create Edge Function for sending codes (or use email service)
- [ ] Update UI to show verification code input
- [ ] Update `handleSimplifiedLogin` to send code
- [ ] Add `handleVerifyCode` function
- [ ] Test SMS verification flow
- [ ] Test Email verification flow
- [ ] Add resend code functionality
- [ ] Add code expiration handling
- [ ] Clean up old codes (cron job or scheduled function)

---

## Next Steps

Would you like me to:
1. Create the SQL migration file?
2. Add the database functions to `scripts/database.js`?
3. Create the Edge Function for sending codes?
4. Update the UI to include the verification step?
5. Update the simplified login flow?

Let me know which parts you'd like me to implement first!
