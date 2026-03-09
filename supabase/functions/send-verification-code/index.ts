import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Log that function was called
  console.log('📞 Edge Function called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })

  try {
    const { phoneOrEmail, code, isEmail } = await req.json()
    
    console.log('📥 Request received:', {
      phoneOrEmail: phoneOrEmail ? phoneOrEmail.substring(0, 5) + '***' : 'missing',
      hasCode: !!code,
      isEmail: isEmail,
      codeLength: code ? code.length : 0
    })
    
    if (!phoneOrEmail || !code) {
      return new Response(
        JSON.stringify({ error: 'phoneOrEmail and code are required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }
    
    if (isEmail) {
      // Send email via Resend
      if (!RESEND_API_KEY) {
        console.log(`[DEV MODE] Email verification code for ${phoneOrEmail}: ${code}`)
        return new Response(
          JSON.stringify({ success: true, method: 'email', devMode: true }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      console.log('📧 Sending email via Resend to:', phoneOrEmail.substring(0, 5) + '***')

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Tam High MTB Team <onboarding@resend.dev>',
          to: [phoneOrEmail],
          subject: 'Your Tam High MTB Team verification code',
          text: `Your Tam High MTB Team verification code is: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you didn't request this, you can ignore this email.`
        })
      })

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text()
        console.error('❌ Resend API error:', errorText)
        return new Response(
          JSON.stringify({ error: `Failed to send email: ${errorText}` }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      console.log('✅ Email sent successfully via Resend')
      return new Response(
        JSON.stringify({ success: true, method: 'email' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    } else {
      // Normalize phone to E.164 for Twilio (assumes US numbers)
      const toE164 = (phone: string): string => {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
        return `+${digits}`;
      };
      const toPhone = toE164(phoneOrEmail);

      // Send SMS via Twilio
      console.log('🔍 Checking Twilio credentials:', {
        hasAccountSID: !!TWILIO_ACCOUNT_SID,
        hasAuthToken: !!TWILIO_AUTH_TOKEN,
        hasPhoneNumber: !!TWILIO_PHONE_NUMBER,
        phoneNumber: TWILIO_PHONE_NUMBER ? TWILIO_PHONE_NUMBER.substring(0, 5) + '***' : 'missing'
      })
      
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        // Development mode: Return mock success if Twilio not configured
        // In production, you should configure Twilio secrets
        console.log(`[DEV MODE] SMS verification code for ${phoneOrEmail}: ${code}`)
        console.log('[DEV MODE] Twilio not configured - returning mock success. Configure Twilio secrets for production.')
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            method: 'sms',
            message: 'Code sent via SMS (dev mode - check console for code)',
            devMode: true,
            code: code // Only in dev mode - remove in production
          }),
          { headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } }
        )
      }
      
      const message = `Your Tam High MTB Team verification code is: ${code}. Valid for 10 minutes.`
      
      console.log('📤 Sending SMS via Twilio:', {
        from: TWILIO_PHONE_NUMBER,
        to: phoneOrEmail.substring(0, 5) + '***',
        messageLength: message.length
      })
      
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
            To: toPhone,
            Body: message
          })
        }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Twilio API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        return new Response(
          JSON.stringify({ error: `Failed to send SMS: ${errorText}` }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }
      
      const result = await response.json()
      console.log('✅ SMS sent successfully:', {
        messageSID: result.sid,
        status: result.status
      })
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'sms',
          message: 'Code sent via SMS'
        }),
        { headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } }
      )
    }
  } catch (error) {
    console.error('❌ Error in send-verification-code:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    })
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    )
  }
})
