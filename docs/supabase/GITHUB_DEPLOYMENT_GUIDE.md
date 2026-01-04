# GitHub Deployment Guide - Team Ride Pro

This comprehensive guide covers deploying Team Ride Pro to GitHub Pages and deploying the Strava Route Proxy Server for production use.

## Overview

Team Ride Pro requires two components for full functionality:
1. **Frontend Application** - Static HTML/CSS/JS (deployed to GitHub Pages)
2. **Strava Route Proxy Server** - Node.js server (deployed to a Node.js hosting service)

---

## Part 1: Deploy Frontend to GitHub Pages

### Step 1.1: Create GitHub Repository

1. Go to https://github.com and sign in
2. Click **"New repository"** (or the "+" icon in top right)
3. Repository settings:
   - **Name**: `team-ride-pro` (or your preferred name)
   - **Description**: "MTB Team Practice Management System"
   - Choose **Public** or **Private** (Public is free for GitHub Pages)
   - **Don't** check "Initialize with README" (we'll push existing code)
4. Click **"Create repository"**

### Step 1.2: Prepare Your Local Repository

If you don't have Git initialized yet:

1. **Install Git** (if needed): https://git-scm.com/downloads
2. Open terminal/command prompt in your project folder
3. Run these commands:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Team Ride Pro with Supabase integration"

# Add GitHub remote (replace USERNAME and REPO_NAME with your values)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Note**: If you already have a Git repository, just add the remote and push:

```bash
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 1.3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (in the repository tabs)
3. Scroll down to **Pages** (in the left sidebar)
4. Under **Source**, configure:
   - **Branch**: Select `main` (or `master` if that's your default)
   - **Folder**: Select `/ (root)`
5. Click **Save**
6. GitHub will show: "Your site is ready to be published at `https://USERNAME.github.io/REPO_NAME`"
7. Wait 1-2 minutes for the site to build and deploy

### Step 1.4: Update Supabase Redirect URLs

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   - `https://USERNAME.github.io/REPO_NAME/**`
   - `https://USERNAME.github.io/REPO_NAME/teamridepro_v2.html`
5. Under **Site URL**, set: `https://USERNAME.github.io/REPO_NAME`
6. Click **Save**

### Step 1.5: Verify Frontend Deployment

1. Visit: `https://USERNAME.github.io/REPO_NAME/teamridepro_v2.html`
2. Test login functionality
3. Verify data loads from Supabase
4. Check browser console for any errors

---

## Part 2: Deploy Strava Route Proxy Server

GitHub Pages only hosts static files, so we need to deploy the Node.js server separately. We'll use **Render** (free tier, easy setup) or **Railway** (alternative).

### Option A: Deploy to Render (Recommended - Free Tier)

#### Step 2.1: Create Render Account

1. Go to https://render.com
2. Click **"Get Started for Free"**
3. Sign up with GitHub (recommended - easier integration)
4. Authorize Render to access your GitHub account

#### Step 2.2: Create New Web Service

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository:
   - Select **"Connect GitHub"** (if not already connected)
   - Select your `team-ride-pro` repository
   - Click **"Connect"**
3. Configure the service:
   - **Name**: `team-ride-pro-strava-proxy` (or your preferred name)
   - **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
   - **Branch**: `main`
   - **Root Directory**: Leave empty (server.js is in root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free` (512 MB RAM)
4. Click **"Create Web Service"**
5. Render will start deploying (takes 2-3 minutes)

#### Step 2.3: Get Your Server URL

1. Once deployment completes, you'll see a URL like:
   - `https://team-ride-pro-strava-proxy.onrender.com`
2. **Important**: The free tier spins down after 15 minutes of inactivity
   - First request after spin-down takes ~30 seconds (cold start)
   - Consider upgrading to paid tier ($7/month) for always-on service
3. Copy this URL - you'll need it in the next step

#### Step 2.4: Update Frontend to Use Deployed Server

1. Go back to your local project folder
2. Find where `PROXY_SERVER_URL` is defined in `teamridepro_v2.html`

   Search for:
   ```javascript
   const PROXY_SERVER_URL = 'http://localhost:3001';
   ```
   
   Or check for any hardcoded `localhost:3001` references

3. Update it to use your Render URL:

   ```javascript
   const PROXY_SERVER_URL = 'https://team-ride-pro-strava-proxy.onrender.com';
   ```

4. Commit and push the change:

   ```bash
   git add teamridepro_v2.html
   git commit -m "Update PROXY_SERVER_URL to use deployed Render service"
   git push
   ```

5. Wait 1-2 minutes for GitHub Pages to rebuild
6. Test the Strava auto-fill feature in your deployed app

#### Step 2.5: Test the Deployed Server

1. Test the health endpoint:
   - Visit: `https://team-ride-pro-strava-proxy.onrender.com/health`
   - Should return: `{"status":"ok"}`
   
2. Test from your deployed frontend:
   - Go to Routes tab
   - Try the "Auto-fill Route Info from Strava" feature
   - Verify it works

---

### Option B: Deploy to Railway (Alternative)

Railway offers a free tier with $5 credit monthly.

#### Step 2.1: Create Railway Account

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign up with GitHub

#### Step 2.2: Deploy from GitHub

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select your `team-ride-pro` repository
4. Railway will auto-detect it's a Node.js project
5. Configure:
   - **Start Command**: `node server.js`
   - **Port**: Railway auto-assigns (usually 3000, but server.js uses 3001)
6. Update `server.js` to use Railway's port:

   ```javascript
   const PORT = process.env.PORT || 3001;
   ```

7. Click **"Deploy"**

#### Step 2.3: Get Your Server URL

1. Once deployed, Railway provides a URL like:
   - `https://team-ride-pro-strava-proxy.up.railway.app`
2. Copy this URL and update `PROXY_SERVER_URL` as in Step 2.4 above

---

### Option C: Deploy to Fly.io (Alternative)

Fly.io offers a free tier with 3 shared VMs.

1. Install Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/
2. Login: `fly auth login`
3. Launch: `fly launch` (from your project directory)
4. Follow prompts
5. Get URL and update `PROXY_SERVER_URL`

---

## Part 3: Update Configuration for Production

### Step 3.1: Update server.js to Use Environment Port

**Important**: Update `server.js` to use the `PORT` environment variable for deployment compatibility.

1. Open `server.js` in your editor
2. Find the line:
   ```javascript
   const PORT = 3001;
   ```
3. Change it to:
   ```javascript
   const PORT = process.env.PORT || 3001;
   ```
4. Save the file
5. Commit and push:
   ```bash
   git add server.js
   git commit -m "Update server.js to use environment PORT variable"
   git push
   ```

This allows hosting services (Render, Railway, Fly.io) to assign their own ports automatically via `process.env.PORT`.

### Step 3.2: Add .gitignore (if not present)

Create or update `.gitignore` to exclude unnecessary files:

```
node_modules/
.env
.DS_Store
*.log
```

### Step 3.3: Update package.json Scripts (Optional)

Your `package.json` already has the correct scripts. Verify:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## Part 4: Connect Custom Domain (Optional)

If you want to use `teamridepro.com` instead of the GitHub Pages URL:

### Step 4.1: Configure GitHub Pages Custom Domain

1. In your GitHub repository → **Settings** → **Pages**
2. Under **Custom domain**, enter: `teamridepro.com`
3. Click **Save**
4. GitHub will provide DNS records to configure

### Step 4.2: Configure DNS

Since your domain is registered through Wix:

1. Log into Wix account
2. Go to **Domains** → **teamridepro.com**
3. Click **"Manage DNS"** or **"DNS Settings"**
4. Add/Edit DNS records as provided by GitHub:
   - Usually a CNAME record pointing to `USERNAME.github.io`
5. Wait 24-48 hours for DNS propagation

### Step 4.3: Update Supabase Redirect URLs

Add your custom domain to Supabase:
- `https://teamridepro.com/**`
- `https://www.teamridepro.com/**` (if using www)

---

## Part 5: Testing & Verification

### Checklist

#### Frontend (GitHub Pages)
- [ ] Site loads at GitHub Pages URL
- [ ] Login works (email/password)
- [ ] Data loads from Supabase
- [ ] Data saves to Supabase
- [ ] Logout works
- [ ] All tabs are accessible (based on user role)

#### Strava Proxy Server
- [ ] Server health endpoint responds: `/health`
- [ ] Server URL is accessible from browser
- [ ] Auto-fill feature works in deployed app
- [ ] Route data is fetched correctly

#### Integration
- [ ] Frontend can communicate with proxy server
- [ ] No CORS errors in browser console
- [ ] Error handling works (if server is down)

---

## Part 6: Maintenance & Monitoring

### Monitoring Render/Railway Service

1. **Render Dashboard**: Check deployment status, logs, metrics
2. **Railway Dashboard**: Monitor usage, logs, metrics
3. **GitHub Actions** (optional): Set up automated deployments

### Free Tier Limitations

#### Render Free Tier:
- Spins down after 15 minutes of inactivity
- Cold starts take ~30 seconds
- Limited to 750 hours/month
- **Solution**: Upgrade to paid ($7/month) for always-on service

#### Railway Free Tier:
- $5 credit monthly (usually enough for small apps)
- Spins down after inactivity
- **Solution**: Upgrade if you need more resources

### Keeping Server Alive (Free Tier Workaround)

If using Render free tier and want to prevent spin-down:

1. Set up a cron job (using a service like cron-job.org) to ping your server every 10 minutes:
   - URL: `https://your-server.onrender.com/health`
   - Frequency: Every 10 minutes

2. Or upgrade to paid tier for always-on service

---

## Part 7: Troubleshooting

### Issue: Frontend not loading on GitHub Pages

**Solutions**:
- Check repository is set to Public (or you have GitHub Pro)
- Verify Pages is enabled in Settings → Pages
- Check branch and folder are correct
- Wait 1-2 minutes after enabling Pages

### Issue: "Redirect URL mismatch" error

**Solutions**:
- Verify Supabase redirect URLs include your GitHub Pages URL
- Include both with and without trailing slash
- Wait a few minutes after updating (cache)

### Issue: Strava proxy server not working

**Solutions**:
- Check server is deployed and running (visit /health endpoint)
- Verify `PROXY_SERVER_URL` in HTML matches deployed server URL
- Check browser console for CORS errors
- Verify server logs in Render/Railway dashboard
- For Render free tier: Wait 30 seconds for cold start

### Issue: Server times out or is slow

**Solutions**:
- Free tier services spin down after inactivity (cold starts are slow)
- Consider upgrading to paid tier for better performance
- Or set up a ping service to keep server awake

### Issue: CORS errors

**Solutions**:
- Verify `server.js` has CORS enabled: `app.use(cors());`
- Check server is using HTTPS (required for GitHub Pages HTTPS)
- Verify server URL is correct and accessible

---

## Part 8: Production Checklist

Before considering deployment complete:

### Security
- [ ] Supabase RLS policies are enabled and tested
- [ ] User roles are properly configured
- [ ] Admin accounts have strong passwords
- [ ] API keys are not exposed in client-side code (anon key is OK - it's public)
- [ ] HTTPS is enabled (automatic with GitHub Pages and Render/Railway)

### Configuration
- [ ] Supabase redirect URLs include production URLs
- [ ] Site URL is set in Supabase
- [ ] PROXY_SERVER_URL points to deployed server
- [ ] Custom domain configured (if using)

### Testing
- [ ] All authentication flows work
- [ ] Data loads and saves correctly
- [ ] Strava auto-fill works
- [ ] Error handling works (test with server down)
- [ ] Mobile responsiveness works

### Backup & Monitoring
- [ ] Database backups are set up (Supabase handles this automatically)
- [ ] Monitoring is configured (Render/Railway dashboards)
- [ ] Error logging is in place (browser console + server logs)

---

## Cost Summary

### Free Tier (Recommended for Start)
- **GitHub Pages**: Free (unlimited)
- **Render Free Tier**: Free (750 hours/month, spins down after inactivity)
- **Supabase Free Tier**: Free (up to 50,000 monthly active users)
- **Total**: $0/month

### Paid Tier (Better Performance)
- **GitHub Pages**: Free
- **Render Paid Tier**: $7/month (always-on, no cold starts)
- **Supabase Free Tier**: Free (or upgrade if needed)
- **Total**: ~$7/month

### Optional Add-ons
- **Custom Domain**: Cost varies by registrar
- **SMS Provider (Twilio)**: ~$0.0075 per SMS
- **Supabase Pro**: $25/month (if you need more resources)

---

## Next Steps After Deployment

1. ✅ Test all functionality thoroughly
2. ✅ Share the GitHub Pages URL with your team
3. ✅ Monitor usage and performance
4. ✅ Set up regular backups (Supabase does this automatically)
5. ✅ Document any custom configurations
6. ✅ Consider upgrading to paid tier if free tier limitations become an issue

---

## Quick Reference

### Frontend URL
```
https://USERNAME.github.io/REPO_NAME/teamridepro_v2.html
```

### Server Health Check
```
https://your-server.onrender.com/health
```

### Supabase Dashboard
```
https://app.supabase.com/project/YOUR_PROJECT_ID
```

### Render Dashboard
```
https://dashboard.render.com
```

### Railway Dashboard
```
https://railway.app/dashboard
```

---

## Support & Resources

- **GitHub Pages Docs**: https://docs.github.com/en/pages
- **Render Docs**: https://render.com/docs
- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs
- **Node.js Deployment Guide**: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

---

**Last Updated**: 2024
**Version**: 1.0

