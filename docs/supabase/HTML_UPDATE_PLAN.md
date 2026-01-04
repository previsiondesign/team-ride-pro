# HTML File Update Plan for Supabase Integration

This document outlines the changes needed to integrate Supabase into `teamridepro_v2.html`.

## Changes Required

### 1. Update `init()` Function
- Initialize Supabase client
- Initialize authentication
- Check authentication state
- If authenticated: load from Supabase
- If not authenticated: show login UI or fallback to localStorage

### 2. Create `loadDataFromSupabase()` Function
- Load riders, coaches, rides, routes, season settings, auto-assign settings from Supabase
- Map database structure to app structure
- Fallback to localStorage if Supabase fails

### 3. Update `saveData()` Function
- Save season settings to Supabase (using `updateSeasonSettings`)
- Save auto-assign settings to Supabase (using `updateAutoAssignSettings`)
- Keep localStorage as fallback

### 4. Update `saveRiderToDB()` Function
- Use `createRider()` / `updateRider()` from database.js
- Keep localStorage as fallback

### 5. Update `saveRideToDB()` Function  
- Use `createRide()` / `updateRide()` from database.js
- Keep localStorage as fallback

Note: `saveCoachToDB()` already has Supabase integration, but may need minor updates.


