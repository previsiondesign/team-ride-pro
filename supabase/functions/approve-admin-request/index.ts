import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || 'https://previsiondesign.github.io/team-ride-pro'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'onboarding@resend.dev'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function htmlPage(title: string, body: string, isError = false): Response {
  const color = isError ? '#721c24' : '#155724'
  const bg = isError ? '#f8d7da' : '#d4edda'
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head><body style="font-family: Arial, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; background: #f8f9fa;"><div style="background: ${bg}; color: ${color}; padding: 20px; border-radius: 8px; border: 1px solid ${isError ? '#f5c6cb' : '#c3e6cb'};"><h2 style="margin-top: 0;">${title}</h2>${body}</div><p style="font-size: 13px; color: #666; margin-top: 16px;">Tam High MTB Team</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders } }
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return htmlPage('Method not allowed', '<p>Use the link from your admin request email.</p>', true)
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return htmlPage('Invalid link', '<p>Missing token. Use the exact link from your admin request email.</p>', true)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return htmlPage('Configuration error', '<p>Server is not configured. Please try again later.</p>', true)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: request, error: fetchError } = await supabase
    .from('admin_access_requests')
    .select('id, name, email')
    .eq('one_time_token', token)
    .is('used_at', null)
    .single()

  if (fetchError || !request) {
    return htmlPage(
      'Link expired or already used',
      '<p>This approval link has already been used or is invalid. To send a new invitation, use the Settings page on the site.</p>',
      true
    )
  }

  const invToken = randomToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data: invitation, error: insertError } = await supabase
    .from('admin_invitations')
    .insert({
      email: request.email,
      token: invToken,
      created_by: null,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (insertError || !invitation) {
    console.error('Failed to create admin_invitation:', insertError)
    return htmlPage('Error', '<p>Could not create invitation. Please try again or use the Settings page.</p>', true)
  }

  const invitationUrl = `${SITE_URL.replace(/\/$/, '')}/accept-invitation.html?token=${encodeURIComponent(invitation.token)}`
  let emailSent = false

  if (RESEND_API_KEY) {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fc5200; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Tam High MTB Team</h1>
          </div>
          <div style="background-color: #f8f9fa; padding: 30px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333; margin-top: 0;">You've been invited!</h2>
            <p>An administrator has invited you to become an administrator for the Tam High MTB Team Practice Manager.</p>
            <p>Click the button below to accept the invitation and create your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" style="background-color: #fc5200; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
            </div>
            <p style="font-size: 14px; color: #666;">Or copy and paste this link: ${invitationUrl}</p>
            <p style="font-size: 12px; color: #999;">This invitation will expire in 7 days.</p>
          </div>
        </body>
      </html>
    `
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [request.email],
        subject: 'Admin Invitation - Tam High MTB Team',
        html: emailHtml,
      }),
    })
    emailSent = res.ok
    if (!res.ok) console.warn('Resend failed (invitation still created):', await res.text())
  }

  await supabase
    .from('admin_access_requests')
    .update({ used_at: new Date().toISOString() })
    .eq('id', request.id)

  if (emailSent) {
    return htmlPage(
      'Invitation sent',
      `<p>An invitation has been sent to <strong>${escapeHtml(request.email)}</strong>. They can use the link in the email to create their account.</p>`
    )
  }

  return htmlPage(
    'Invitation created',
    `<p>Invitation created for <strong>${escapeHtml(request.email)}</strong>. Email could not be sent (e.g. domain limits). Please share this link with them:</p>
     <p style="word-break: break-all; background: #fff; padding: 12px; border-radius: 4px; font-size: 13px;"><a href="${invitationUrl}">${invitationUrl}</a></p>
     <p style="font-size: 13px;">This link expires in 7 days.</p>`
  )
})

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return (text || '').replace(/[&<>"']/g, m => map[m])
}
