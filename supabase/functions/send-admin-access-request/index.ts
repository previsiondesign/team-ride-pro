import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Always use Resend's default sender so this function works without domain verification.
const FROM_EMAIL = 'onboarding@resend.dev'
const ADMIN_ALERT_EMAIL = Deno.env.get('ADMIN_ALERT_EMAIL') || 'acphillips@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, phone, email } = await req.json()

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'name and email are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      )
    }

    let oneTimeToken: string | null = null
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      oneTimeToken = randomToken()
      const { error } = await supabase.from('admin_access_requests').insert({
        name,
        phone: phone || null,
        email,
        one_time_token: oneTimeToken,
      })
      if (error) {
        console.error('Failed to insert admin_access_requests:', error)
        oneTimeToken = null
      }
    }

    if (!RESEND_API_KEY) {
      console.warn('[DEV MODE] Resend not configured - logging admin access request');
      console.log(`Admin access request: name=${name}, phone=${phone || '(none)'}, email=${email}`);
      if (oneTimeToken && SUPABASE_URL) console.log(`Approve link: ${SUPABASE_URL}/functions/v1/approve-admin-request?token=${oneTimeToken}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Request logged (dev mode - check console)',
          devMode: true
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const approveUrl = oneTimeToken && SUPABASE_URL
      ? `${SUPABASE_URL}/functions/v1/approve-admin-request?token=${encodeURIComponent(oneTimeToken)}`
      : null

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
            <h2 style="color: #333; margin-top: 0;">Admin access requested</h2>
            <p>Someone has requested admin access to the Practice Manager.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Name</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${escapeHtml(name)}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Email</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${escapeHtml(email)}</td></tr>
              <tr><td style="padding: 8px 0;"><strong>Phone</strong></td><td style="padding: 8px 0;">${escapeHtml(phone || '—')}</td></tr>
            </table>
            ${approveUrl ? `
            <p style="margin-top: 24px;">Send an invitation to this person with one click (no need to log in):</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${escapeHtml(approveUrl)}" style="background-color: #fc5200; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Approve &amp; send invitation</a>
            </div>
            <p style="font-size: 13px; color: #666;">This link can only be used once. You can also approve from the <strong>Settings</strong> page of the site.</p>
            ` : `
            <p style="margin-top: 24px;">You can approve this user from the <strong>Settings</strong> page of the site by sending them an admin invitation.</p>
            `}
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
        to: [ADMIN_ALERT_EMAIL],
        subject: 'Admin access request - Tam High MTB Team',
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
    console.info(`✔ Admin access request email sent: ${result.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Request submitted. An administrator will be in touch.'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error('Error in send-admin-access-request:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    )
  }
})

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return (text || '').replace(/[&<>"']/g, m => map[m])
}
