# Quick Start: Verification Code Setup Checklist

## ✅ Prerequisites Checklist

Before the verification code step will appear, you need to complete these steps:

### Step 1: Create Database Table (REQUIRED)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy contents of `sql/ADD_VERIFICATION_CODES_TABLE.sql`
- [ ] Paste and run the SQL
- [ ] Verify: Check Tables → `verification_codes` should exist

**If this step is skipped, `createVerificationCode()` will fail and the verification form won't show.**

### Step 2: Deploy Edge Function (REQUIRED for SMS/Email to work)
- [ ] Create Edge Function named: `send-verification-code`
- [ ] Copy code from `docs/EDGE_FUNCTION_SEND_VERIFICATION_CODE.md`
- [ ] Deploy the function

**Note:** Even if Edge Function isn't configured, the code will still work in development mode (shows code in alert).

### Step 3: Set Up Twilio (OPTIONAL - for SMS)
- [ ] Create Twilio account
- [ ] Get Account SID, Auth Token, Phone Number
- [ ] Add to Supabase Secrets:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`

## Testing the Flow

### If Database Table Exists:
1. Go to `teamridepro_v2.html?view=assignments`
2. Enter phone/email from your database
3. Click "Send Verification Code"
4. **You should see:**
   - Button changes to "Generating code..." then "Sending SMS..." or "Sending email..."
   - Then the verification code input form appears
   - Code is shown in alert if Edge Function not configured

### If Database Table Doesn't Exist:
1. You'll see an error in console: "relation 'verification_codes' does not exist"
2. The verification form won't appear
3. **Fix:** Run Step 1 above

## Troubleshooting

### Verification form not appearing?
1. **Check browser console** for errors
2. **Most common issue:** Database table not created
   - Error: `relation "verification_codes" does not exist`
   - Fix: Run `sql/ADD_VERIFICATION_CODES_TABLE.sql`
3. **Check if functions exist:**
   - Open browser console
   - Type: `typeof createVerificationCode`
   - Should return: `"function"`
   - If returns `"undefined"`, refresh the page

### Code not sending?
1. **Check Edge Function is deployed:**
   - Supabase Dashboard → Edge Functions
   - Should see `send-verification-code` function
2. **Check Twilio secrets (for SMS):**
   - Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Should have all 3 Twilio secrets
3. **Development mode:**
   - If Edge Function not configured, code will show in alert
   - This is expected behavior for testing

### Getting errors?
- Check browser console for full error messages
- Check Supabase Edge Function logs
- Verify database table exists
- Verify Edge Function is deployed
