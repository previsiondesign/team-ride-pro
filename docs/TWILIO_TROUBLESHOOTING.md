# Twilio SMS Troubleshooting Guide

## Quick Checklist

Follow these steps to verify your Twilio setup:

### Step 1: Check Supabase Edge Function Secrets

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Verify these three secrets are set:
   - `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token  
   - `TWILIO_PHONE_NUMBER` - Your Twilio phone number (format: +14155551234)

**If secrets are missing:**
- Add them in the Supabase Dashboard
- Secrets are automatically available to Edge Functions (no redeploy needed)

### Step 2: Check Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → `send-verification-code` → **Logs**
2. Try sending a verification code again
3. Look for log entries that show:
   - Whether Twilio credentials were found
   - Any error messages from Twilio API
   - The verification code (if in dev mode)

**What to look for:**
- ✅ `[DEV MODE]` message = Twilio secrets not configured, code returned in response
- ❌ `Twilio error:` = Credentials configured but Twilio API call failed
- ✅ `Code sent via SMS` = Success (check your phone)

### Step 3: Verify Twilio Account Status

1. Log into **Twilio Console**: https://console.twilio.com
2. Check **Account Status**:
   - Account should be **Active**
   - Check for any account restrictions or warnings
3. Check **Balance**:
   - Go to **Billing** → **Account Balance**
   - Ensure you have credits (free trial includes $15.50)
4. Verify **Phone Number**:
   - Go to **Phone Numbers** → **Manage** → **Active Numbers**
   - Ensure your number has **SMS** capability enabled
   - Note the exact format (should include country code, e.g., +14155551234)

### Step 4: Test Twilio Connection Directly

You can test if Twilio is working by checking the API directly:

1. In Twilio Console → **Phone Numbers** → Click on your number
2. Try sending a test message from the Twilio console
3. Or use the Twilio API Explorer to test

### Step 5: Check Phone Number Format

**Important:** Phone numbers must be in E.164 format:
- ✅ Correct: `+14155551234` (US number with country code)
- ✅ Correct: `+442071234567` (UK number)
- ❌ Wrong: `4155551234` (missing + and country code)
- ❌ Wrong: `(415) 555-1234` (formatted number)

**In your database:**
- Check that phone numbers in `riders` and `coaches` tables are in E.164 format
- If not, you may need to normalize them

### Step 6: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Try sending a verification code
4. Look for:
   - Debug messages from `sendVerificationCode` function
   - Any error messages
   - The response from the Edge Function

**Expected console output:**
```
🔐 Calling Edge Function: {url: "...", hasAnonKey: true, ...}
📡 Edge Function Response: {status: 200, ok: true}
```

### Step 7: Verify Edge Function Code

Check if the function is in "dev mode" (returns code without sending SMS):

1. Look at Edge Function logs
2. If you see `[DEV MODE]` messages, Twilio secrets are not configured
3. The function will return the code in the response (check browser console or network tab)

## Common Issues and Solutions

### Issue 1: "Twilio credentials not configured"

**Symptoms:**
- Edge Function logs show `[DEV MODE]`
- Code is returned in response but no SMS sent

**Solution:**
- Add Twilio secrets in Supabase Dashboard → Edge Functions → Secrets
- No redeploy needed - secrets are automatically available

### Issue 2: "Failed to send SMS" Error

**Symptoms:**
- Edge Function logs show Twilio API error
- Status code 400 or 500 from Twilio

**Possible Causes:**
1. **Invalid phone number format** - Must be E.164 format (+country code)
2. **Twilio account restrictions** - Check account status in Twilio Console
3. **Insufficient balance** - Check Twilio account balance
4. **Phone number not verified** - For trial accounts, recipient numbers must be verified
5. **SMS capability disabled** - Check phone number settings in Twilio

**Solutions:**
- Verify phone number format in database
- Check Twilio account status and balance
- For trial accounts, verify recipient phone numbers in Twilio Console
- Ensure phone number has SMS capability enabled

### Issue 3: SMS Sent but Not Received

**Symptoms:**
- Edge Function logs show success
- No message received on phone

**Possible Causes:**
1. **Carrier blocking** - Some carriers block short codes or unknown numbers
2. **Spam filtering** - Check spam/junk folder
3. **Wrong phone number** - Verify the number in database matches your phone
4. **Trial account restrictions** - Twilio trial accounts can only send to verified numbers

**Solutions:**
- Verify your phone number is correct in the database
- For Twilio trial: Add your phone number to verified recipients in Twilio Console
- Check phone's spam/junk folder
- Try from a different phone/carrier

### Issue 4: Phone Number Format Issues

**Symptoms:**
- Database has phone numbers in various formats
- Some work, some don't

**Solution:**
Normalize all phone numbers to E.164 format. Run this SQL in Supabase:

```sql
-- Normalize phone numbers in riders table
UPDATE riders 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;

-- Normalize phone numbers in coaches table  
UPDATE coaches 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;
```

**Note:** This assumes US numbers. For international numbers, you may need country-specific logic.

## Testing Without Twilio (Development Mode)

If Twilio isn't set up yet, the Edge Function will work in "dev mode":
- Code is generated and logged
- Code is returned in the API response
- Check browser console or Edge Function logs for the code

**To see the code:**
1. Open browser Developer Tools (F12)
2. Go to **Network** tab
3. Send verification code
4. Find the request to `send-verification-code`
5. Check the response - it will include `code` field in dev mode

## Next Steps

Once Twilio is working:
1. Remove dev mode code from Edge Function (for security)
2. Set up Twilio webhooks for delivery status (optional)
3. Monitor SMS usage and costs in Twilio Console
4. Consider upgrading from trial account for production use

## Getting Help

If issues persist:
1. Check **Supabase Edge Function Logs** for detailed error messages
2. Check **Twilio Console** → **Monitor** → **Logs** for SMS delivery status
3. Review **Twilio Debugger** for API call details
4. Verify all credentials are correct (no extra spaces, correct format)
