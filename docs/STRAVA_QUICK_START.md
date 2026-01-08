# Strava Auto-Fill Quick Start Guide

## What Was Wrong?

The Strava auto-fill feature requires a Node.js server to be running. The issue was:
1. ✅ **FIXED**: Dependencies weren't installed (now installed)
2. ⚠️ **ACTION NEEDED**: Server needs to be started

## How to Use the Strava Auto-Fill Feature

### Step 1: Start the Server

**Option A: Double-click the batch file (Easiest)**
- Double-click `START_SERVER.bat` in the project folder
- A command window will open showing: `Strava route proxy server running on http://localhost:3001`
- **Keep this window open** while using the app

**Option B: Use Command Prompt**
```cmd
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"
npm start
```

**Option C: Use PowerShell (with full path)**
```powershell
& "C:\Program Files\nodejs\npm.cmd" start
```

### Step 2: Verify Server is Running

1. Open your browser
2. Go to: `http://localhost:3001/health`
3. You should see: `{"status":"ok"}`

### Step 3: Use Auto-Fill in the App

1. Open `teamridepro.html` in your browser
2. Go to the **"Routes"** tab
3. Click **"Add/Edit Strava Routes"**
4. Click **"Add New Route"**
5. Paste a Strava embed code into the text area
6. Click **"🔍 Auto-fill Route Info from Strava"**
7. The route name, distance, and elevation should auto-populate!

## Important Notes

- **The server must be running** for auto-fill to work
- Keep the server window open while using the app
- If you close the server window, auto-fill will stop working
- You can always manually enter route information if the server isn't running

## Troubleshooting

If auto-fill doesn't work:
1. Check if server is running: Visit `http://localhost:3001/health`
2. Check browser console (F12) for errors
3. See `docs/STRAVA_TROUBLESHOOTING.md` for detailed help

## Next Steps

For production use, you'll want to:
- Deploy the server to a hosting service (Heroku, AWS, etc.)
- Update `PROXY_SERVER_URL` in `teamridepro.html` to point to the hosted server
- This way, users won't need to run the server locally
















