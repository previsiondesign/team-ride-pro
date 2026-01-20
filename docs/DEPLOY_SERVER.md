# Deploying the Strava Route Proxy Server

This guide covers deploying the server to various cloud hosting services so it runs 24/7 without needing your local machine.

## Quick Start: Recommended Services

### Option 1: Render (Easiest - Recommended)
✅ Free tier available  
✅ Simple setup  
✅ Auto-deploys from GitHub  
✅ HTTPS included  

**Steps:**
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `strava-route-proxy`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
5. Click "Create Web Service"
6. Wait for deployment (takes 2-3 minutes)
7. Copy your service URL (e.g., `https://strava-route-proxy.onrender.com`)
8. Update `PROXY_SERVER_URL` in `teamridepro_v2.html`:
   ```javascript
   const PROXY_SERVER_URL = 'https://your-service-url.onrender.com';
   ```
9. Deploy the updated HTML file to GitHub Pages

**Note:** Free tier services may "sleep" after inactivity, causing first request to be slow (~30 seconds). Paid tiers avoid this.

---

### Option 2: Railway (Simple & Fast)
✅ Free tier with $5 credit/month  
✅ Fast deploys  
✅ Auto-deploys from GitHub  

**Steps:**
1. Go to [railway.app](https://railway.app) and sign up/login
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway auto-detects Node.js - no configuration needed!
6. Wait for deployment (~1 minute)
7. Click on the service → "Settings" → copy the domain
8. Update `PROXY_SERVER_URL` in `teamridepro_v2.html`:
   ```javascript
   const PROXY_SERVER_URL = 'https://your-service.railway.app';
   ```
9. Deploy the updated HTML file to GitHub Pages

---

### Option 3: Fly.io (Good for Node.js)
✅ Free tier available  
✅ Global edge network  
✅ Great documentation  

**Steps:**
1. Install Fly CLI: 
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```
2. Sign up/login:
   ```bash
   flyctl auth login
   ```
3. Launch app:
   ```bash
   flyctl launch
   ```
4. Follow prompts (or use defaults)
5. Deploy:
   ```bash
   flyctl deploy
   ```
6. Get your URL:
   ```bash
   flyctl info
   ```
7. Update `PROXY_SERVER_URL` in `teamridepro_v2.html`

---

## Alternative: Supabase Edge Function

Since you're already using Supabase, you could convert the server to an Edge Function. This would:
- ✅ Run on Supabase infrastructure
- ✅ No separate hosting needed
- ✅ Automatic HTTPS
- ⚠️ Requires refactoring code to Deno

**Would you like instructions for converting to a Supabase Edge Function?**

---

## After Deployment

### Update Frontend

Once your server is deployed, update `teamridepro_v2.html`:

```javascript
// Line ~26437
const PROXY_SERVER_URL = 'https://your-deployed-server-url.com';
```

### Test the Deployed Server

1. Visit: `https://your-server-url.com/health`
2. Should return: `{"status":"ok"}`
3. Test the API:
   ```
   https://your-server-url.com/api/fetch-strava-route?url=https://www.strava.com/routes/123456
   ```

### Deploy Frontend Changes

After updating `PROXY_SERVER_URL`:
```bash
git add teamridepro_v2.html
git commit -m "Update PROXY_SERVER_URL to deployed server"
git push origin main
```

---

## Troubleshooting

### Server Returns 404
- Check health endpoint: `/health`
- Verify start command is correct
- Check server logs in hosting dashboard

### CORS Errors
- Server already includes CORS headers (`cors` middleware)
- If issues persist, check browser console for specific errors

### First Request is Slow (Free Tiers)
- Free tier services may "sleep" after inactivity
- First request can take 30+ seconds to "wake up"
- Subsequent requests are fast
- Consider paid tier for always-on service

### Server Not Starting
- Check Node.js version (hosting service should auto-detect)
- Verify `package.json` has correct start script
- Check deployment logs in hosting dashboard

---

## Recommended: Render or Railway

For easiest setup, use **Render** or **Railway**:
- Both auto-deploy from GitHub
- Both have free tiers
- Both auto-detect Node.js
- Minimal configuration needed

Just connect your repo and deploy! 🚀
