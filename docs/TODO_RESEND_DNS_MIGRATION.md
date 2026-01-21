# Resend Email DNS Setup – To Do After Transfer Lock Ends (around 2026-02-04)

You’re mid-migration to Cloudflare DNS but Wix is still the authoritative DNS because you can’t change nameservers during the 60-day registrar lock (domain registered 2026-12-06). Finish these steps once the lock expires.

## Where you are now
- Cloudflare zone exists for `teamridepro.com`, but status shows **Invalid nameservers** (Wix still authoritative).
- DNS records are already added in Cloudflare for Wix site, Google Workspace MX, and Resend (send.* subdomain).
- Wix UI confirms nameservers are not editable during this flow.

## Cloudflare nameservers to use
- `gabe.ns.cloudflare.com`
- `love.ns.cloudflare.com`

## Steps to complete after 60-day lock (≈ 2026-02-04)

1) **Transfer or change nameservers at registrar**
   - If Wix is registrar: Wix Dashboard → Domains → teamridepro.com → Advanced/Nameservers (when available) → choose “Use custom nameservers” → set the two Cloudflare NS above → Save.
   - If you move the domain to another registrar (recommended: Cloudflare Registrar or Namecheap): unlock domain in Wix, get EPP/Auth code, start transfer, then set nameservers to the two Cloudflare NS once transfer begins/allows it.

2) **Keep the DNS records in Cloudflare as already set**
   - Wix site A/CNAME records (for site hosting)
   - Google Workspace MX:
     - ASPMX.L.GOOGLE.COM (prio 1)
     - ALT1.ASPMX.L.GOOGLE.COM (prio 5)
     - ALT2.ASPMX.L.GOOGLE.COM (prio 5)
     - ALT3.ASPMX.L.GOOGLE.COM (prio 10)
     - ALT4.ASPMX.L.GOOGLE.COM (prio 10)
   - Root SPF (TXT at `@`): `v=spf1 include:_spf.google.com include:amazonses.com ~all`
   - Resend records:
     - TXT `resend._domainkey` = DKIM key from Resend
     - TXT `send` = `v=spf1 include:amazonses.com ~all`
     - MX `send` = `feedback-smtp.us-east-1.amazonses.com` (or the exact value Resend provided), priority 10
     - Optional: TXT `_dmarc` = `v=DMARC1; p=none;`
   - All mail/DNS records should be **DNS only** (no proxy).

3) **Disable DNSSEC (if any) before switching NS**
   - In Wix (or current registrar) ensure DNSSEC is off prior to changing nameservers. You can re-enable later in Cloudflare if needed.

4) **Wait for propagation**
   - After nameserver change, allow 15–60 minutes (sometimes up to 24–48h).
   - In Cloudflare Overview, status should turn green/active.

5) **Re-check in Resend**
   - In Resend DNS panel click “Re-check”.
   - DKIM/SPF/MX for `send` should verify once Cloudflare is authoritative.

6) **Test**
   - Send an admin invitation email via the app.
   - If email still fails, check Resend logs and Cloudflare DNS (confirm records exist and are DNS-only).

## If staying with Wix until the lock ends
- You can keep using Google Workspace for email.
- Resend may remain unverified for SPF/MX on the `send` subdomain with Wix DNS; that’s expected. Complete the steps above after 2026-02-04.

