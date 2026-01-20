# Step-by-Step Setup: SMS/Email Verification

Follow these steps in order to implement verification codes for simplified login.

## Step 1: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `sql/ADD_VERIFICATION_CODES_TABLE.sql`
3. Paste and run the SQL
4. Verify the table was created: Check Tables → `verification_codes`

## Step 2: Set Up Twilio (For SMS - Optional)

### 2.1: Create Twilio Account
1. Go to https://www.twilio.com
2. Sign up for free trial (includes $15.50 credit)
3. Verify your phone number

### 2.2: Get Twilio Credentials
1. In Twilio Console → Settings → General
2. Copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)
3. In Twilio Console → Phone Numbers → Manage → Buy a number
4. Select a number with SMS capability (US numbers are cheapest)
5. Note the phone number (format: +14155551234)

### 2.3: Configure in Supabase
1. In Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add these secrets:
   - `TWILIO_ACCOUNT_SID` = Your Account SID
   - `TWILIO_AUTH_TOKEN` = Your Auth Token  
   - `TWILIO_PHONE_NUMBER` = Your Twilio phone number (with +1 prefix)

## Step 3: Create Edge Function for Sending Codes

### 3.1: Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### 3.2: Initialize Supabase Functions (if not already done)
```bash
supabase functions new send-verification-code
```

### 3.3: Add the Code
1. Open `supabase/functions/send-verification-code/index.ts`
2. Copy the code from `docs/EDGE_FUNCTION_SEND_VERIFICATION_CODE.md`
3. Paste it into the file

### 3.4: Deploy the Function
```bash
supabase functions deploy send-verification-code
```

**OR** use Supabase Dashboard:
1. Go to Edge Functions → Create Function
2. Name: `send-verification-code`
3. Paste the code
4. Deploy

## Step 4: Set Up Email Sending (For Email Verification)

### Option A: Use Supabase's Built-in Email (Simplest)
1. Supabase Dashboard → Settings → Auth → SMTP Settings
2. Configure your SMTP provider (Gmail, SendGrid, etc.)
3. Update the Edge Function to use Supabase's email service

### Option B: Use Resend (Recommended)
1. Sign up at https://resend.com (free tier available)
2. Get API key
3. Add `RESEND_API_KEY` to Supabase secrets
4. Update Edge Function to use Resend API

### Option C: Use SendGrid
1. Sign up at https://sendgrid.com (free tier available)
2. Get API key
3. Add `SENDGRID_API_KEY` to Supabase secrets
4. Update Edge Function to use SendGrid API

## Step 5: Test the Implementation

### 5.1: Test Database Functions
1. Open browser console on your site
2. Try: `await createVerificationCode('4155551234', 'rider', 1)`
3. Should return: `{ code: '123456', id: '...' }`

### 5.2: Test Code Verification
1. Get a code from step 5.1
2. Try: `await verifyCode('4155551234', '123456')`
3. Should return: `{ valid: true, userType: 'rider', userId: 1 }`

### 5.3: Test Full Flow
1. Go to `teamridepro_v2.html?view=assignments`
2. Enter a phone number or email from your database
3. Click "Send Verification Code"
4. Check for code (SMS, email, or console if not configured)
5. Enter the code
6. Should redirect to assignments view

## Step 6: Production Considerations

### 6.1: Code Expiration
- Codes expire after 10 minutes (configured in `createVerificationCode`)
- Old codes are cleaned up automatically (via `cleanup_expired_codes` function)

### 6.2: Rate Limiting
Consider adding rate limiting to prevent abuse:
- Limit codes per phone/email per hour
- Add to Edge Function or database trigger

### 6.3: Security
- Codes are single-use (marked as verified after use)
- Codes expire after 10 minutes
- Only valid codes can be verified

## Troubleshooting

### "Edge Function not found" Error
- Make sure the function is deployed: `supabase functions deploy send-verification-code`
- Check function name matches exactly: `send-verification-code`

### "Twilio credentials not configured" Error
- Verify secrets are set in Supabase Dashboard
- Check secret names match exactly: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Codes Not Sending
- Check Twilio account has credits
- Verify phone number format (must include country code, e.g., +14155551234)
- Check Edge Function logs in Supabase Dashboard

### Email Not Sending
- Verify SMTP/email service is configured
- Check email service API key is set in secrets
- Review Edge Function logs for errors

## Next Steps After Setup

1. Test with real phone numbers/emails
2. Monitor Twilio usage and costs
3. Set up code cleanup cron job (optional)
4. Add rate limiting (optional)
5. Customize email/SMS message templates
