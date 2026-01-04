# Strava Route Proxy Server

This server-side proxy allows the application to automatically fetch route name, distance, and elevation gain from Strava route pages.

## Setup Instructions

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Open a terminal/command prompt in this directory
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Server

Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Testing

Test the server is working:
- Open: http://localhost:3001/health
- Should return: `{"status":"ok"}`

### Usage in the Application

1. Make sure the server is running
2. In the application, paste a Strava embed code
3. Click the "🔍 Auto-fill Route Info from Strava" button
4. The route name, distance, and elevation will be automatically populated

### Configuration

If you need to change the server port, edit `server.js` and change the `PORT` constant, then update `PROXY_SERVER_URL` in `teamridepro.html`.

### Troubleshooting

**Server won't start:**
- Make sure Node.js is installed: `node --version`
- Make sure all dependencies are installed: `npm install`
- Check if port 3001 is already in use

**Can't fetch route data:**
- Make sure the server is running
- Check browser console for errors
- Verify the route URL is accessible (not private/requires login)
- Some routes may require Strava login to view - these won't work

**CORS errors:**
- The server includes CORS headers, but if you're accessing from a different origin, you may need to adjust CORS settings in `server.js`

### Alternative: Deploy to a Server

For production use, you can deploy this server to:
- Heroku
- AWS Lambda
- Google Cloud Functions
- Any Node.js hosting service

Update `PROXY_SERVER_URL` in `teamridepro.html` to point to your deployed server URL.

















