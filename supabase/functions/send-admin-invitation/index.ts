import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
const SITE_URL = Deno.env.get('SITE_URL') || 'https://previsiondesign.github.io/team-ride-pro'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, invitationUrl, inviterName } = await req.json()

    if (!email || !invitationUrl) {
      return new Response(
        JSON.stringify({ error: 'email and invitationUrl are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      )
    }

    if (!RESEND_API_KEY) {
      console.warn('[DEV MODE] Resend not configured - logging invitation URL');
      console.log(`📧 Invitation email would be sent to: ${email}`);
      console.log(`🔗 Invitation URL: ${invitationUrl}`);
      return new Response(
        JSON.stringify({
          success: true,
          method: 'email',
          message: 'Email would be sent (dev mode - check console)',
          devMode: true,
          invitationUrl: invitationUrl
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fc5200; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Tam High MTB Team</h1>
          </div>
          <div style="background-color: #f8f9fa; padding: 30px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333; margin-top: 0;">You've been invited!</h2>
            <p>${inviterName || 'An administrator'} has invited you to become an administrator for the Tam High MTB Team Practice Manager.</p>
            <p>Click the button below to accept the invitation and create your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" style="background-color: #fc5200; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #999; word-break: break-all; background: white; padding: 10px; border-radius: 4px;">${invitationUrl}</p>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">This invitation will expire in 7 days.</p>
          </div>
        </body>
      </html>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: 'Admin Invitation - Tam High MTB Team',
        html: emailHtml,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Resend API error:', errorText)
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${errorText}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      )
    }

    const result = await response.json()
    console.info(`✔ Email sent successfully: ${result.id}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        method: 'email',
        message: 'Invitation email sent successfully'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error('Error in send-admin-invitation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    )
  }
})
