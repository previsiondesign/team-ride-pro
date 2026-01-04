# Strava Auto-Fill Troubleshooting Guide

If the Strava auto-fill feature isn't working, follow these steps to diagnose and fix the issue.

## Quick Checklist

- [ ] Node.js is installed
- [ ] Dependencies are installed (`node_modules` folder exists)
- [ ] Server is running on `http://localhost:3001`
- [ ] Browser can reach the server (test with `/health` endpoint)

## Step 1: Check if Node.js is Installed

### In PowerShell:
```powershell
node --version
```

### In Command Prompt (cmd):
```cmd
node --version
```

**If you get an error:**
- Node.js is not installed, OR
- Node.js is not in your system PATH

### Solution A: Install Node.js
1. Go to https://nodejs.org/
2. Download the LTS (Long Term Support) version
3. Run the installer
4. Restart your terminal/PowerShell
5. Verify: `node --version` should show a version number

### Solution B: Find Node.js if Already Installed
Node.js is often installed in:
- `C:\Program Files\nodejs\`
- `C:\Program Files (x86)\nodejs\`
- `C:\Users\YourName\AppData\Roaming\npm\`

If you find it, you can:
1. Add it to your PATH, OR
2. Use the full path to run commands (e.g., `"C:\Program Files\nodejs\npm.cmd" install`)

## Step 2: Install Dependencies

Once Node.js is working, install the required packages:

```bash
npm install
```

**Expected output:**
- Creates a `node_modules` folder
- Shows a list of installed packages
- No errors

**If you get errors:**
- Make sure you're in the project directory
- Try: `npm install --legacy-peer-deps`
- Check your internet connection

## Step 3: Start the Server

### Option A: Using npm (Recommended)
```bash
npm start
```

### Option B: Using the Batch File (Windows)
Double-click `START_SERVER.bat` or run:
```cmd
START_SERVER.bat
```

### Option C: Direct Node Command
```bash
node server.js
```

**Expected output:**
```
Strava route proxy server running on http://localhost:3001
API endpoint: http://localhost:3001/api/fetch-strava-route?url=<strava-route-url>
```

**If you get an error:**
- **"Port 3001 already in use"**: Another program is using port 3001. Either:
  - Close the other program, OR
  - Change the port in `server.js` (line 7) and update `PROXY_SERVER_URL` in `teamridepro.html`
- **"Cannot find module"**: Dependencies aren't installed. Run `npm install` first.

## Step 4: Test the Server

1. **Open your browser** and go to: `http://localhost:3001/health`
2. **You should see:** `{"status":"ok"}`

If this works, the server is running correctly!

## Step 5: Test in the Application

1. **Open** `teamridepro.html` in your browser
2. **Go to** the "Routes" tab
3. **Click** "Add/Edit Strava Routes"
4. **Click** "Add New Route"
5. **Paste** a Strava embed code
6. **Click** "🔍 Auto-fill Route Info from Strava"

**If it works:**
- The route name, distance, and elevation should auto-populate
- You'll see a green "✓ Route data fetched successfully!" message

**If it doesn't work:**
- Check the browser console (F12) for errors
- Common errors:
  - `Failed to fetch`: Server isn't running
  - `CORS error`: Server CORS settings (shouldn't happen with current setup)
  - `404 Not Found`: Wrong URL or server not running
  - `500 Internal Server Error`: Server error (check server console)

## Common Issues and Solutions

### Issue: "npm is not recognized"

**Solution:**
- Node.js might not be installed
- Node.js might not be in PATH
- Try using the full path: `"C:\Program Files\nodejs\npm.cmd" install`

### Issue: "Cannot find module 'express'"

**Solution:**
- Dependencies aren't installed
- Run: `npm install`
- Make sure you're in the project root directory

### Issue: "Port 3001 already in use"

**Solution:**
1. Find what's using the port:
   ```powershell
   netstat -ano | findstr :3001
   ```
2. Kill the process, OR
3. Change the port in `server.js`:
   ```javascript
   const PORT = 3002; // Change to a different port
   ```
4. Update `PROXY_SERVER_URL` in `teamridepro.html`:
   ```javascript
   const PROXY_SERVER_URL = 'http://localhost:3002';
   ```

### Issue: "Server starts but auto-fill doesn't work"

**Check:**
1. Is the server actually running? (Test `/health` endpoint)
2. Open browser DevTools (F12) → Console tab
3. Look for error messages
4. Check the Network tab to see if the request is being made

### Issue: "Route data not found" or "null values"

**Possible causes:**
- The Strava route page structure changed
- The route is private/requires login
- The route URL is malformed

**Solution:**
- Try a different, public Strava route
- Manually enter the route information

## Still Having Issues?

1. **Check the server console** for error messages
2. **Check the browser console** (F12 → Console) for client-side errors
3. **Verify the server is accessible**: Open `http://localhost:3001/health` in your browser
4. **Try a simple test**: Manually call the API:
   ```
   http://localhost:3001/api/fetch-strava-route?url=https://www.strava.com/routes/YOUR_ROUTE_ID
   ```

## Alternative: Manual Entry

If the auto-fill feature isn't working, you can always manually enter:
- Route name
- Distance
- Elevation

The auto-fill is a convenience feature, not required for the application to work.















