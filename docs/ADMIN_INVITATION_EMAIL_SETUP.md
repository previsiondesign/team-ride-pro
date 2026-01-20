# Setting Up Email Service for Admin Invitations

Currently, the admin invitation system creates invitation links but displays them in the UI rather than sending them via email. This guide shows you how to set up automatic email sending for admin invitations.

## Current Behavior

When you send an admin invitation:
1. An invitation token is created in the `admin_invitations` table
2. An invitation URL is generated
3. **The URL is displayed in the UI** (you need to copy/paste it manually)

## Solution Options

### Option 1: Supabase Edge Function (Recommended)

Similar to the SMS verification code system, create an Edge Function to send invitation emails.

**Pros:**
- ✅ Uses existing Supabase infrastructure
- ✅ Consistent with your current architecture
- ✅ Free tier available
- ✅ Easy to deploy

**Cons:**
- ⚠️ Requires email service setup (SendGrid, Resend, etc.)

### Option 2: Use Supabase Email Templates (If Available)

Supabase may support custom email templates for invitations.

**Pros:**
- ✅ Built into Supabase
- ✅ No additional service needed

**Cons:**
- ⚠️ Limited customization
- ⚠️ May not be available in all Supabase plans

### Option 3: Third-Party Email Service (SendGrid, Resend, Mailgun)

Use a dedicated email service with better deliverability.

**Pros:**
- ✅ Better deliverability
- ✅ More features (analytics, templates)
- ✅ Professional appearance

**Cons:**
- ⚠️ Additional service to manage
- ⚠️ May have costs

---

## Recommended: Supabase Edge Function with Resend

**Resend** is a modern email API that's easy to set up and has a generous free tier (3,000 emails/month).

### Step 1: Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address
4. Add and verify your domain (or use their test domain for development)

### Step 2: Get Resend API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Name it: `supabase-edge-function`
4. Copy the API key (starts with `re_`)

### Step 3: Create Supabase Edge Function

Create a new Edge Function similar to `send-verification-code`:

**File:** `supabase/functions/send-admin-invitation/index.ts`

```typescript
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
```

### Step 4: Deploy Edge Function

1. **Create the function directory:**
   ```bash
   mkdir -p supabase/functions/send-admin-invitation
   ```

2. **Create the file** `supabase/functions/send-admin-invitation/index.ts` with the code above

3. **Deploy the function:**
   ```bash
   supabase functions deploy send-admin-invitation --no-verify-jwt
   ```

4. **Set environment variables in Supabase:**
   - Go to **Edge Functions** → **send-admin-invitation** → **Settings**
   - Add secrets:
     - `RESEND_API_KEY`: Your Resend API key
     - `FROM_EMAIL`: Your verified email (e.g., `noreply@yourdomain.com`)
     - `SITE_URL`: Your site URL (e.g., `https://previsiondesign.github.io/team-ride-pro`)

### Step 5: Update Frontend Code

Modify `sendAdminInvitation()` in `teamridepro_v2.html` to call the Edge Function:

**Find this section (around line 9825):**
```javascript
const invitation = await createAdminInvitation(email);

// Generate invitation URL
const invitationUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}accept-invitation.html?token=${invitation.token}`;
```

**Replace with:**
```javascript
const invitation = await createAdminInvitation(email);

// Generate invitation URL
const invitationUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}accept-invitation.html?token=${invitation.token}`;

// Send invitation email via Edge Function
try {
    const currentUser = getCurrentUser();
    const inviterName = currentUser?.user_metadata?.name || currentUser?.email || 'An administrator';
    
    const anonKey = window.SUPABASE_ANON_KEY || '';
    const supabaseUrl = window.SUPABASE_URL || '';
    
    if (anonKey && supabaseUrl) {
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-admin-invitation`;
        
        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({
                email: email,
                invitationUrl: invitationUrl,
                inviterName: inviterName
            })
        });
        
        if (response.ok) {
            statusDiv.innerHTML = `
                <div style="padding: 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px; margin-top: 8px;">
                    <strong style="color: #2e7d32;">Invitation sent successfully!</strong><br>
                    <span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">An email has been sent to ${email} with the invitation link.</span>
                </div>
            `;
            statusDiv.style.color = '#2e7d32';
            emailInput.value = ''; // Clear the input
        } else {
            // If email fails, still show the link as fallback
            throw new Error('Email sending failed');
        }
    } else {
        throw new Error('Supabase credentials not available');
    }
} catch (emailError) {
    console.warn('Failed to send invitation email, showing link instead:', emailError);
    // Fallback: Show the link in the UI (current behavior)
    statusDiv.innerHTML = `
        <div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-top: 8px;">
            <strong style="color: #856404;">Invitation created (email not sent)</strong><br>
            <span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">Please send this link to ${email}:</span>
            <div style="margin-top: 8px; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; word-break: break-all; font-family: monospace;">
                ${invitationUrl}
            </div>
        </div>
    `;
    statusDiv.style.color = '#856404';
}
```

---

## Alternative: Using SendGrid

If you prefer SendGrid:

1. **Sign up at [sendgrid.com](https://sendgrid.com)**
2. **Create an API Key** (Settings → API Keys)
3. **Update the Edge Function** to use SendGrid's API:
   ```typescript
   const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
   const FROM_EMAIL = Deno.env.get('FROM_EMAIL')
   
   const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${SENDGRID_API_KEY}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       personalizations: [{ to: [{ email: email }] }],
       from: { email: FROM_EMAIL },
       subject: 'Admin Invitation - Tam High MTB Team',
       content: [{ type: 'text/html', value: emailHtml }],
     }),
   })
   ```

---

## Testing

1. **Test with Resend test domain:**
   - Use `onboarding@resend.dev` as `FROM_EMAIL` (no domain verification needed)
   - Send test invitation to your own email

2. **Check Edge Function logs:**
   - Go to Supabase Dashboard → Edge Functions → send-admin-invitation → Logs
   - Look for success/error messages

3. **Verify email delivery:**
   - Check recipient's inbox (and spam folder)
   - Click the invitation link to verify it works

---

## Troubleshooting

### Email not sending
- Check Edge Function logs in Supabase dashboard
- Verify `RESEND_API_KEY` is set correctly
- Verify `FROM_EMAIL` is a verified domain in Resend
- Check Resend dashboard for delivery status

### 401 Unauthorized
- Verify the Edge Function is deployed with `--no-verify-jwt`
- Check that `apikey` and `Authorization` headers are included in the fetch request

### Email goes to spam
- Verify your domain in Resend
- Use a custom `FROM_EMAIL` with your domain
- Add SPF/DKIM records (Resend provides instructions)

---

## Next Steps

Once email sending is working:
1. Remove the manual link display (or keep as fallback)
2. Add email delivery tracking
3. Consider adding invitation reminders for unused invitations
