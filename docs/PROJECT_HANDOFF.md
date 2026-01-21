# Project Handoff - Team Practice Pro

**Date:** January 20, 2026  
**Status:** Active Development - Paused for DNS Migration Lock Period  
**Next Action Date:** ~February 4, 2026 (after 60-day domain transfer lock expires)

---

## Project Overview

**Team Practice Pro** is a web-based practice management system for the Tam High MTB Team. It's a single-page application (`teamridepro_v2.html`) that manages:
- Rider and coach rosters
- Practice scheduling and group assignments
- Route management with Strava integration
- Attendance tracking and reporting
- Admin user management with invitation system

**Tech Stack:**
- Frontend: Vanilla JavaScript (single HTML file: `teamridepro_v2.html`)
- Backend: Supabase (PostgreSQL database, Auth, Edge Functions)
- Hosting: GitHub Pages (https://previsiondesign.github.io/team-ride-pro/)
- Email: Resend API (via Supabase Edge Function)
- SMS: Twilio (via Supabase Edge Function)

---

## Current Session Summary (January 20, 2026)

### ✅ Completed in This Session

1. **Admin Invitation Email System**
   - Created Supabase Edge Function: `supabase/functions/send-admin-invitation/index.ts`
   - Integrated email sending into frontend (`sendAdminInvitation()` function)
   - Added comprehensive setup documentation
   - **Status:** Code complete, waiting for DNS verification

2. **Admin Invitation Management**
   - Added delete button for pending invitations
   - Fixed delete function (added DELETE RLS policy)
   - Fixed user existence check (allows re-invitation if user deleted from Auth)
   - **Status:** Fully functional

3. **Login/Logout Improvements**
   - Fixed login button stuck in "Signing in..." state after logout
   - Added `resetLoginButtonState()` function
   - **Status:** Fully functional

4. **Group Assignments Behavior**
   - Different behavior for future vs past practices:
     - **Future practices:** Unchecking rider removes them completely from groups
     - **Past practices:** Unchecking keeps rider in groups (greyed/unavailable)
   - **Status:** Fully functional

5. **Strava Route Proxy Server**
   - Deployed to Render.com: `https://strava-route-proxy.onrender.com`
   - Updated frontend to use deployed server
   - Added 30-second delay warning note
   - **Status:** Fully functional

6. **Undo/Redo for Group Assignments**
   - Implemented history tracking system
   - Added undo/redo buttons (↶ ↷) to action bar
   - **Status:** Fully functional

### ⏸️ Pending (Blocked by DNS Migration Lock)

**Admin Invitation Email Sending:**
- **Issue:** Domain `teamridepro.com` registered through Wix on 12/6/26
- **Problem:** Wix doesn't support subdomain MX records required by Resend
- **Block:** 60-day transfer lock prevents changing nameservers until ~2/4/26
- **Current State:**
  - Cloudflare DNS zone configured with all required records
  - Nameservers: `gabe.ns.cloudflare.com` and `love.ns.cloudflare.com`
  - DNS records ready but not active (Wix still authoritative)
- **Next Steps:** See `docs/TODO_RESEND_DNS_MIGRATION.md` for complete instructions

**Email Service Status:**
- Edge Function deployed and configured
- Resend API key set in Supabase secrets
- FROM_EMAIL set to `teamridepro@gmail.com` (needs domain verification)
- **Temporary Workaround:** System falls back to showing invitation link in UI if email fails

---

## Key Files and Locations

### Main Application
- **`teamridepro_v2.html`** - Main application file (27,864 lines)
- **`scripts/database.js`** - Supabase database functions
- **`scripts/auth.js`** - Authentication functions
- **`scripts/roles.js`** - Role-based access control
- **`scripts/supabase-config.js`** - Supabase client initialization

### Edge Functions
- **`supabase/functions/send-verification-code/index.ts`** - SMS/email verification codes (working)
- **`supabase/functions/send-admin-invitation/index.ts`** - Admin invitation emails (waiting for DNS)

### Database Migrations
- **`sql/ADD_ADMIN_INVITATIONS_TABLE.sql`** - Admin invitations table
- **`sql/ADD_ADMIN_INVITE_RLS.sql`** - RLS policies for invitations
- **`sql/ADD_ADMIN_INVITATIONS_DELETE_POLICY.sql`** - DELETE policy for invitations
- **`sql/ADD_VERIFICATION_CODES_TABLE.sql`** - Verification codes table

### Documentation
- **`docs/ADMIN_INVITATION_EMAIL_SETUP.md`** - Complete email setup guide
- **`docs/TODO_RESEND_DNS_MIGRATION.md`** - DNS migration steps (for ~2/4/26)
- **`docs/DEPLOY_ADMIN_INVITATION_FUNCTION.md`** - Edge Function deployment guide
- **`docs/DEPLOY_SERVER.md`** - Strava proxy server deployment guide

---

## Important Configuration Details

### Supabase Configuration
- **URL:** `https://kweharxfvvjwrnswrooo.supabase.co`
- **Anon Key:** Exposed in `scripts/supabase-config.js` (also on `window` object for Edge Functions)
- **Auth:** Uses `sessionStorage` (auto-logout on browser close)

### Edge Function Secrets (Supabase Dashboard)
- **`RESEND_API_KEY`** - Resend API key (configured)
- **`FROM_EMAIL`** - `teamridepro@gmail.com` (needs domain verification)
- **`SITE_URL`** - `https://previsiondesign.github.io/team-ride-pro`
- **`TWILIO_ACCOUNT_SID`** - For SMS verification (configured)
- **`TWILIO_AUTH_TOKEN`** - For SMS verification (configured)
- **`TWILIO_PHONE_NUMBER`** - For SMS verification (configured)

### Cloudflare DNS Configuration
- **Nameservers:** `gabe.ns.cloudflare.com`, `love.ns.cloudflare.com`
- **Status:** Configured but not active (Wix still authoritative)
- **Records Ready:**
  - A records for Wix hosting (3 records)
  - CNAME `www` → `cdn1.wixdns.net`
  - MX records for Google Workspace (5 records)
  - TXT `@` (root) SPF: `v=spf1 include:_spf.google.com include:amazonses.com ~all`
  - TXT `resend._domainkey` - DKIM key
  - TXT `send` - SPF: `v=spf1 include:amazonses.com ~all`
  - MX `send` → `feedback-smtp.us-east-1.amazonses.com` (priority 10)
  - TXT `_dmarc` - DMARC policy

### External Services
- **GitHub Repository:** `previsiondesign/team-ride-pro`
- **Live Site:** `https://previsiondesign.github.io/team-ride-pro/`
- **Strava Proxy:** `https://strava-route-proxy.onrender.com` (Render.com)
- **Resend Account:** teamridepro@gmail.com
- **Twilio:** Configured (toll-free number, verification pending)

---

## Known Issues and Limitations

1. **Email Sending Blocked**
   - Cannot send admin invitation emails until DNS migration complete
   - System gracefully falls back to showing invitation link in UI
   - **Workaround:** Manual link sharing works fine

2. **Domain Transfer Lock**
   - Domain purchased 12/6/26 through Wix
   - 60-day lock prevents nameserver changes until ~2/4/26
   - Cannot use Cloudflare DNS until lock expires

3. **Wix DNS Limitations**
   - Wix doesn't support subdomain MX records
   - This is why we need to migrate to Cloudflare DNS

---

## Recent Feature Implementations

### Admin Invitation System
- **Location:** Settings tab → Admin Invitations section
- **Features:**
  - Send invitation via email (when DNS ready)
  - View pending invitations
  - Resend invitations
  - Delete pending invitations
  - Automatic expiration (7 days)

### Simplified Login for Riders/Coaches
- **URL:** `teamridepro_v2.html?view=assignments`
- **Features:**
  - Single input (phone or email)
  - SMS/email verification code
  - Auto-detects rider vs coach
  - Restricted view (only assignments tab)

### Reporting Tab
- **Location:** Left of Practice Planner tab
- **Features:**
  - View attendance for any practice
  - Navigate between practices (arrows)
  - Manual toggle attended/absent
  - Sort by rider name (A-Z, Z-A)
  - Red text for absent riders
  - Dynamic title with date

### Undo/Redo for Group Assignments
- **Location:** Practice Planner → Group Assignments action bar
- **Features:**
  - Undo button (↶) - reverts last change
  - Redo button (↷) - reapplies undone change
  - Up to 50 history entries
  - Works for all assignment changes (drag/drop, toggles, autofill)

---

## Next Steps (When Resuming)

### Immediate (After DNS Migration - ~2/4/26)
1. **Complete DNS Migration**
   - Follow steps in `docs/TODO_RESEND_DNS_MIGRATION.md`
   - Change nameservers from Wix to Cloudflare
   - Verify all DNS records propagate
   - Test email sending in Resend

2. **Verify Email Sending**
   - Test admin invitation email flow
   - Confirm emails arrive correctly
   - Update FROM_EMAIL if needed (verify domain in Resend)

### Future Enhancements (Optional)
- Email delivery tracking
- Invitation reminders for unused invitations
- Better error handling for email failures
- Email templates customization

---

## Important Notes for Next Agent

1. **Domain Management:**
   - Domain is registered through Wix
   - Google Workspace email is configured
   - DNS migration to Cloudflare is planned for ~2/4/26

2. **Authentication:**
   - Uses Supabase Auth with sessionStorage (auto-logout on browser close)
   - Admin users: Email/password
   - Riders/Coaches: Phone or email with verification code

3. **Database:**
   - All data stored in Supabase PostgreSQL
   - RLS (Row Level Security) enabled
   - Key tables: `riders`, `coaches`, `rides`, `user_roles`, `admin_invitations`, `verification_codes`

4. **Deployment:**
   - Auto-deploys to GitHub Pages on push to `main` branch
   - Edge Functions deploy via Supabase Dashboard (no CLI needed)
   - Strava proxy server on Render.com

5. **Testing:**
   - Test admin invitations after DNS migration
   - Verify email delivery
   - Test fallback behavior if email fails

---

## Contact Information

- **Domain:** teamridepro.com
- **Email:** teamridepro@gmail.com
- **GitHub:** previsiondesign/team-ride-pro
- **Supabase Project:** kweharxfvvjwrnswrooo

---

## Session Context

This handoff document was created after implementing:
- Admin invitation email system (blocked by DNS)
- Delete functionality for invitations
- Login button state fixes
- Group assignment behavior improvements
- Strava proxy server deployment
- Undo/redo functionality

The project is in a stable state with all code complete. The only blocker is the DNS migration, which must wait until the 60-day transfer lock expires (~February 4, 2026).
