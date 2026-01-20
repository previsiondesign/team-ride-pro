# Edge Function: Send Verification Code

This Edge Function sends verification codes via SMS (Twilio) or Email.

## Location
Create this file at: `supabase/functions/send-verification-code/index.ts`

## Code

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

serve(async (req) => {
  try {
    const { phoneOrEmail, code, isEmail } = await req.json()
    
    if (!phoneOrEmail || !code) {
      return new Response(
        JSON.stringify({ error: 'phoneOrEmail and code are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    if (isEmail) {
      // Send email via Supabase's built-in email service
      // For now, we'll use a simple console log (you can integrate with SendGrid, Resend, etc.)
      console.log(`Email verification code for ${phoneOrEmail}: ${code}`)
      
      // TODO: Implement email sending
      // Option 1: Use Supabase's email service (if configured)
      // Option 2: Use a service like SendGrid, Resend, or AWS SES
      // Option 3: Use Supabase's built-in auth email templates
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'email',
          message: 'Code sent via email (check console for development)' 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      // Send SMS via Twilio
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return new Response(
          JSON.stringify({ 
            error: 'Twilio credentials not configured',
            message: 'Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in Supabase secrets'
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
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
        const errorText = await response.text()
        console.error('Twilio error:', errorText)
        return new Response(
          JSON.stringify({ error: `Failed to send SMS: ${errorText}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
      
      const result = await response.json()
      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'sms',
          message: 'Code sent via SMS'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in send-verification-code:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

## Setup Instructions

### 1. Create the Edge Function

1. In Supabase Dashboard → Edge Functions → Create a new function
2. Name it: `send-verification-code`
3. Paste the code above
4. Deploy

### 2. Set Environment Variables (Secrets)

1. In Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add these secrets:
   - `TWILIO_ACCOUNT_SID` = Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN` = Your Twilio Auth Token
   - `TWILIO_PHONE_NUMBER` = Your Twilio phone number (e.g., +14155551234)

### 3. Test the Function

You can test it from the Supabase Dashboard or via the frontend code.

## Alternative: Email Implementation

For email sending, you have several options:

### Option 1: Use Supabase's Built-in Email (Recommended for simplicity)

Supabase can send emails via their built-in service. You'll need to:
1. Configure SMTP in Supabase Dashboard → Settings → Auth → SMTP Settings
2. Or use Supabase's email templates

### Option 2: Use Resend (Recommended for production)

1. Sign up at https://resend.com
2. Get API key
3. Update Edge Function to use Resend API

### Option 3: Use SendGrid

1. Sign up at https://sendgrid.com
2. Get API key
3. Update Edge Function to use SendGrid API

## Testing Without Twilio/Email

During development, if the Edge Function isn't configured, the code will be logged to the console. You can also modify the function to return the code in development mode.
