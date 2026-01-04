# Deployment Guide - Team Ride Pro

This guide covers deploying your application and connecting it to your custom domain (teamridepro.com).

## Deployment Options

### Option 1: GitHub Pages (Recommended for Testing)

GitHub Pages is free and perfect for hosting static sites.

#### Step 1: Create GitHub Repository

1. Go to https://github.com and sign in
2. Click **"New repository"**
3. Repository name: `team-ride-pro` (or your preferred name)
4. Choose **Public** or **Private** (Public is free)
5. **Don't** initialize with README (we'll push existing code)
6. Click **"Create repository"**

#### Step 2: Push Your Code

If you don't have Git set up locally:

1. Install Git: https://git-scm.com/downloads
2. Open terminal/command prompt in your project folder
3. Run these commands:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Team Ride Pro"

# Add GitHub remote (replace USERNAME and REPO_NAME)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

#### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (in repository tabs)
3. Scroll to **Pages** (in left sidebar)
4. Under **Source**, select:
   - **Branch**: `main` (or `master`)
   - **Folder**: `/ (root)`
5. Click **Save**
6. Your site will be available at: `https://USERNAME.github.io/REPO_NAME`

#### Step 4: Update Supabase Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://USERNAME.github.io/REPO_NAME/**`
   - `https://USERNAME.github.io/REPO_NAME/teamridepro_v2.html`
3. Click **Save**

---

### Option 2: Netlify (Alternative)

Netlify offers automatic deployments and custom domains.

#### Step 1: Create Netlify Account

1. Go to https://www.netlify.com
2. Sign up (can use GitHub account)
3. Free tier includes custom domains

#### Step 2: Deploy Site

1. In Netlify dashboard, click **"Add new site"** → **"Import an existing project"**
2. Connect to GitHub repository (or drag & drop folder)
3. Configure build settings:
   - **Build command**: (leave empty - static site)
   - **Publish directory**: `/` (root)
4. Click **"Deploy site"**

#### Step 3: Configure Custom Domain

1. In site settings → **Domain management**
2. Click **"Add custom domain"**
3. Enter: `teamridepro.com`
4. Follow DNS configuration instructions

#### Step 4: Update Supabase Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://teamridepro.com/**`
   - `https://www.teamridepro.com/**` (if using www)
3. Click **Save**

---

### Option 3: Vercel (Alternative)

Similar to Netlify, good for static sites.

1. Go to https://vercel.com
2. Sign up and connect GitHub
3. Import repository
4. Deploy (auto-detects static site)
5. Configure custom domain in project settings

---

## Connecting Custom Domain (teamridepro.com)

Since your domain is registered through Wix, you have a few options:

### Option A: Use Wix DNS (Recommended if staying on Wix)

1. Log into Wix account
2. Go to **Domains** → **teamridepro.com**
3. Click **"Manage DNS"** or **"DNS Settings"**
4. Add/Edit DNS records:

#### For GitHub Pages:
- **Type**: CNAME
- **Name**: `@` or `www` (or both)
- **Value**: `USERNAME.github.io`
- **TTL**: 3600 (default)

#### For Netlify:
- **Type**: CNAME
- **Name**: `@`
- **Value**: `your-site-name.netlify.app`
- **TTL**: 3600

5. Save changes
6. Wait 24-48 hours for DNS propagation

### Option B: Transfer DNS to Hosting Provider

1. In Wix, find your domain's nameservers
2. Update nameservers at your hosting provider (GitHub/Netlify)
3. Let hosting provider manage DNS

**Note**: This gives hosting provider full control but is more flexible.

### Option C: Use Subdomain (Easiest)

If DNS changes are complicated, use a subdomain:

1. In Wix DNS, add:
   - **Type**: CNAME
   - **Name**: `app` (or `team` or `admin`)
   - **Value**: `USERNAME.github.io`
2. Access site at: `app.teamridepro.com`
3. Update Supabase redirect URLs to include subdomain

---

## Environment Variables (Production)

### Important: Secure Your API Keys

For production, you should NOT hardcode your Supabase keys in the JavaScript files.

### Option 1: Use Environment Variables (Netlify/Vercel)

If using Netlify or Vercel:

1. In site settings → **Environment variables**
2. Add:
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key`
3. Update `scripts/supabase-config.js` to read from environment:

```javascript
// Read from environment variables (set by hosting provider)
const SUPABASE_URL = window.SUPABASE_URL || 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your-anon-key';
```

4. In your HTML, add before supabase-config.js:

```html
<script>
    // These will be injected by your hosting provider
    window.SUPABASE_URL = '{{SUPABASE_URL}}';  // Netlify/Vercel template
    // OR set via environment variable in build process
</script>
```

### Option 2: Keep in Config File (GitHub Pages)

For GitHub Pages (static hosting), you have limited options:

1. **Keep keys in supabase-config.js** (less secure but acceptable for anon key)
2. **Use Supabase RLS policies** to protect data (recommended)
3. The anon key is meant to be public - security comes from RLS policies

**Note**: The Supabase `anon` key is designed to be public. Real security comes from Row Level Security (RLS) policies, which you've already set up.

---

## Production Checklist

Before going live:

### Security
- [ ] Supabase RLS policies are enabled and tested
- [ ] User roles are properly configured
- [ ] Admin accounts have strong passwords
- [ ] Phone authentication is configured with production SMS provider
- [ ] Email verification is enabled (optional but recommended)

### Configuration
- [ ] Supabase redirect URLs include production domain
- [ ] Site URL is set to production domain in Supabase
- [ ] Environment variables are set (if using)
- [ ] API keys are configured correctly

### Testing
- [ ] Admin login works (email/password)
- [ ] Coach login works (phone/SMS)
- [ ] Rider login works (phone/SMS)
- [ ] All tabs are accessible to appropriate users
- [ ] Data loads correctly from Supabase
- [ ] Data saves correctly to Supabase
- [ ] Logout works
- [ ] Session persists across page refreshes

### DNS
- [ ] Domain is pointing to hosting provider
- [ ] SSL certificate is active (automatic with GitHub/Netlify/Vercel)
- [ ] Both www and non-www work (or redirect configured)

### Backup
- [ ] Original localStorage data is backed up
- [ ] Database exports are scheduled (manual or automated)
- [ ] Supabase project has backups enabled (automatic on paid plans)

---

## Post-Deployment

### Monitor Usage

1. **Supabase Dashboard** → Monitor API usage, database size, auth usage
2. **Hosting Provider Dashboard** → Monitor bandwidth, visits
3. **Twilio Dashboard** → Monitor SMS usage and costs

### Set Up Monitoring (Optional)

- **Supabase**: Built-in dashboard shows errors and usage
- **Sentry**: Error tracking (free tier available)
- **Google Analytics**: User tracking (if desired)

### Cost Monitoring

- **Supabase Free Tier**: 50,000 monthly active users
- **Twilio**: ~$0.0075 per SMS
- **Hosting**: Free (GitHub Pages/Netlify/Vercel free tiers)
- **Total Estimated Cost**: ~$10-20/month (mostly SMS)

---

## Troubleshooting Deployment

### Issue: "Redirect URL mismatch"

**Solution**: 
- Check Supabase redirect URLs include your production domain
- Ensure URL format matches exactly (including https://)
- Wait a few minutes after updating (cache)

### Issue: "Site not loading"

**Solution**:
- Check DNS propagation (can take 24-48 hours)
- Verify CNAME/A records are correct
- Check hosting provider status page

### Issue: "API key errors"

**Solution**:
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check environment variables are set (if using)
- Ensure config file is loaded before other scripts

### Issue: "SSL certificate errors"

**Solution**:
- GitHub/Netlify/Vercel provide SSL automatically
- Wait a few minutes after DNS changes
- Clear browser cache
- Check certificate in browser developer tools

---

## Recommended Deployment Path

1. ✅ **Development**: Local testing with localhost
2. ✅ **Staging**: GitHub Pages with test URL (username.github.io)
3. ✅ **Production**: Custom domain (teamridepro.com)

Test thoroughly in staging before pointing custom domain to production.

---

## Next Steps After Deployment

1. ✅ Test all authentication flows
2. ✅ Verify data migration completed successfully
3. ✅ Test with real users (coaches and riders)
4. ✅ Monitor for errors
5. ✅ Set up regular backups
6. ✅ Document any issues/solutions for future reference



