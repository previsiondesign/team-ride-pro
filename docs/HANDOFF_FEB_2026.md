# Agent Handoff — TeamRide Pro (formerly Team Practice Pro)

**Date:** February 13, 2026
**Use:** Give this to a new AI agent when starting a fresh chat. It contains full project context, recent changes, and the v2/v3 branch architecture.

---

## Project Overview

- **Name:** TeamRide Pro (Tam High MTB Team Roster & Practice Manager)
- **Local path:** `D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro`
  - **NOTE:** The folder is scheduled to be renamed to `TeamRide Pro`. If it has already been renamed, the path is `...\MTB Team\TeamRide Pro`. The workspace file is already `TeamRide Pro.code-workspace`.
- **Repo:** `previsiondesign/team-ride-pro` on GitHub
- **Live site (v2):** https://previsiondesign.github.io/team-ride-pro/teamridepro_v2.html
- **GitHub Pages** serves from the `main` branch

Single-page app: roster management, practice scheduling, group assignments, routes (Strava integration), attendance tracking, admin/user roles, backup/restore. Tech: vanilla JS, Supabase (Auth + Postgres DB + Edge Functions), GitHub Pages hosting.

---

## Branch Architecture (v2 / v3 Split)

| Branch | Purpose | Main HTML file | Status |
|--------|---------|---------------|--------|
| **`main`** | v2 production | `teamridepro_v2.html` | Live on GitHub Pages, do NOT break |
| **`v3-dev`** | v3 development | `teamridepro_v3.html` | Active development branch |

Both branches share the same Supabase database and configuration.

### How to work with branches

- **Work on v3:** `git checkout v3-dev`
- **Hotfix v2:** `git checkout main`, fix, commit, push
- **Bring v2 fixes into v3:** `git checkout v3-dev && git merge main`
- **Deploy v3 as production (when ready):** merge `v3-dev` into `main`, or reconfigure GitHub Pages

### What's different on `v3-dev` vs `main`

1. `teamridepro_v2.html` renamed to `teamridepro_v3.html`
2. `index.html` and `accept-invitation.html` reference `teamridepro_v3.html`
3. `scripts/app-main.js` references `teamridepro_v3.html`
4. `.gitignore` updated to exclude `temp/`, `csv/`, `supabase/.temp/`
5. Server files moved to `server/` directory (`server.js`, `package.json`, `package-lock.json`, `START_SERVER.sh`, `START_SERVER.bat`, `README_SERVER.md`)
6. Root-level markdown files moved to `docs/` (`QUICK_REFERENCE.md`, `VISUAL_EDITING_GUIDE.md`)
7. Duplicate `FOLDER_ORGANIZATION.md` removed from root

---

## File Structure

### On `main` (v2 production)

```
Root/
├── teamridepro_v2.html          # Main app (~1,800 lines markup, no inline JS/CSS)
├── index.html                    # GitHub Pages redirect → teamridepro_v2.html
├── accept-invitation.html        # Admin invitation signup page
├── rider-view.html               # Read-only rider view
├── verify-account.html           # Account verification page
├── privacy-policy.html           # Privacy policy
├── styles.css                    # Main stylesheet
├── styles-overrides.css          # Override styles (loaded after styles.css)
├── TeamRide Pro.code-workspace   # VS Code / Cursor workspace file
├── .gitignore
│
├── scripts/
│   ├── app-main.js               # ALL app logic (~28,500+ lines)
│   ├── supabase-config.js        # Supabase client initialization
│   ├── auth.js                   # Authentication (login, signOut, etc.)
│   ├── database.js               # DB CRUD wrappers for all tables
│   └── roles.js                  # Role helpers (getCurrentUserRole, etc.)
│
├── sql/                           # 40+ SQL migration files
│   ├── ADD_ROUTE_START_LOCATION.sql
│   ├── ADD_ADMIN_EDIT_LOCKS.sql
│   ├── ADD_ADMIN_TAKE_OVER_REQUESTS.sql
│   └── ... (many more)
│
├── assets/                        # Images, logos
├── docs/                          # 25+ documentation files
├── supabase/                      # Supabase config + edge functions
│   └── functions/send-verification-code/
│
├── server.js                      # Local dev server (on main; moved to server/ on v3-dev)
├── package.json                   # Server dependencies
├── START_SERVER.sh / .bat         # Server start scripts
├── README_SERVER.md               # Server readme
│
├── temp/                          # Scratch files, backups (not gitignored on main)
└── csv/                           # Data import files
```

### On `v3-dev` (differences from main)

- `teamridepro_v3.html` instead of `teamridepro_v2.html`
- `server/` directory contains server files (moved from root)
- `docs/` has `QUICK_REFERENCE.md` and `VISUAL_EDITING_GUIDE.md` (moved from root)
- `temp/`, `csv/`, `supabase/.temp/` are gitignored

### Script load order

Head: `styles.css` → `styles-overrides.css` → Supabase CDN → `supabase-config.js` → `auth.js` → `database.js` → `roles.js` → jsPDF → Google APIs
Body (end): `app-main.js`

---

## Recent Changes (Last 2 Sessions — Feb 2026)

### 1. Route System Overhaul

**Start Location feature:**
- Added `start_location` column to routes table (`sql/ADD_ROUTE_START_LOCATION.sql`)
- Route list view now shows a "Start" column (sortable)
- Start location is a required field when adding/editing routes
- Route dropdowns filter by practice start location by default
- Toggle option at bottom of dropdown: "Load routes from all locations" / "Show only routes from this location"
- Toggle is per-practice (doesn't persist to other practices)

**Route dialog consolidation:**
- "Add Strava Route" and "Add Route" merged into one "Add New Route" button
- Dialog opens to manual entry by default; orange "Use Strava Route" button reveals Strava embed field

**Route dropdown formatting:**
- Format: `DISTANCE/ELEVATION – 𝐑𝐨𝐮𝐭𝐞 𝐍𝐚𝐦𝐞` (route name in Unicode Mathematical Bold)
- `toBoldUnicode()` helper function converts ASCII to bold Unicode since `<option>` elements can't be styled with CSS

**Removed features:**
- Estimated time system (all functions, settings modal, display, and sort options removed)
- Time/fitness matching separator line in route dropdown
- One-time "Assign Start Locations" migration button

**Sortable route list:**
- Column headers (Route Name, Start, Distance, Elevation Gain) are clickable to sort
- Sort indicators (▲/▼) show on active column
- Syncs with the sort dropdown

### 2. Backup System Overhaul

**`saveAllDataToSupabase()`** — was an empty stub, now fully implemented:
- Iterates through all data types: riders, coaches, rides, routes, races, seasonSettings, autoAssignSettings, colorNames, riderFeedback, rideNotes, riderAvailability
- Uses UPSERT operations for each table
- Progress logging and error collection

**`getAllDataForBackup()`** — expanded:
- Now `async`; fetches additional tables from Supabase: `rider_feedback`, `ride_notes`, `rider_availability`, `color_names`
- Backup version set to `2.0`

**`restoreFromBackup()`** — updated to restore additional tables and call `saveAllDataToSupabase()`

**`exportAllData()` / `importSeasonSettings()`** — updated:
- Export now includes the extra tables; version `3.0`
- Import handles v3.0 backup format with the additional tables

### 3. Admin Lockout Bypass System

- When a second coach-admin logs in while another holds the edit lock, they see 3 options: Read-Only, Request Access, Developer Mode
- Request Access: creates a take-over request; lock holder sees popup with Yes/No (30s auto-grant countdown)
- If denied, requester stays read-only; lock holder can provide a reason
- DB tables: `admin_edit_locks`, `admin_take_over_requests`
- Key functions: `showLockConflictDialog`, `showTakeOverRequestPopup`, `initAdminEditLock`, `releaseAdminEditLock`

### 4. Phase 1 Code Split (Earlier)

- Inline `<script>` (~28,335 lines) extracted to `scripts/app-main.js`
- Inline `<style>` extracted to `styles-overrides.css`
- `teamridepro_v2.html` reduced from ~30,260 to ~1,800 lines

### 5. Project Renaming & v3 Branch Setup (This Session)

- Workspace file renamed: `Team Practice Pro.code-workspace` → `TeamRide Pro.code-workspace`
- Folder rename pending (user must close Cursor and rename manually)
- `v3-dev` branch created and pushed to `origin/v3-dev`
- All v3-dev organizational changes (gitignore, file moves) committed and pushed

---

## Key Code Locations in `scripts/app-main.js`

| Feature | Functions / Identifiers |
|---------|------------------------|
| **Auth / Login** | `handleAuthStateChange`, `showAdminLogin`, `handleLogin` |
| **Admin Lock / Takeover** | `showLockConflictDialog`, `showTakeOverRequestPopup`, `initAdminEditLock`, `releaseAdminEditLock`, `setReadOnlyMode` |
| **Roster** | `addRider`, `saveRiderFromModal`, `addNewRiderToAttendanceLists`, roster table rendering |
| **Rides / Assignments** | `renderAssignments`, `saveRideToDB`, practice calendar |
| **Routes** | `renderRoutes`, `openAddRouteModal`, `saveRoute`, `renderRouteOptions`, `routeOptionHtml`, `handleRouteSelectChange`, `toggleRouteLocationFilter` |
| **Route Helpers** | `toBoldUnicode`, `sortRoutes`, `setRoutesSortBy` |
| **Backup / Restore** | `getAllDataForBackup`, `restoreFromBackup`, `saveAllDataToSupabase`, `exportAllData`, `importSeasonSettings` |
| **Route Dropdown** | `renderRouteOptions` (location filtering, toggle options), `routeOptionHtml` (DISTANCE/ELEVATION – BOLD NAME format) |

### Key HTML element IDs (in teamridepro_v2.html / v3.html)

- `#lock-conflict-overlay`, `#take-over-request-overlay` — admin lock UI
- `#routes-sort-by` — route list sort dropdown
- `#add-route-modal` — unified add/edit route dialog
- Route list table is dynamically generated by `renderRoutes()`

---

## Database (Supabase)

### Key Tables

| Table | Purpose |
|-------|---------|
| `riders` | Rider profiles (name, pace, fitness, etc.) |
| `coaches` | Coach profiles |
| `rides` | Practice sessions (date, groups JSONB, availableRiders, etc.) |
| `routes` | Route data (name, distance, elevation, start_location, strava_embed, cached_preview) |
| `races` | Race events |
| `season_settings` | Global season config (JSONB blobs for various settings) |
| `auto_assign_settings` | Auto group assignment algorithm settings |
| `color_names` | Group color labels |
| `rider_feedback` | Per-ride rider feedback |
| `ride_notes` | Per-ride coach notes |
| `rider_availability` | Per-ride rider availability |
| `backups` | Automated backup snapshots (backup_data JSONB) |
| `admin_edit_locks` | Single-user edit lock |
| `admin_take_over_requests` | Lock takeover request/response |
| `admin_invitations` | Email-based admin invitations |
| `admin_disabled_users` | Disabled user accounts |

### SQL Migrations

All in `sql/` directory. Run against Supabase SQL editor. Notable recent ones:
- `ADD_ROUTE_START_LOCATION.sql` — adds `start_location TEXT` to routes
- `ADD_ADMIN_EDIT_LOCKS.sql` — admin edit lock table
- `ADD_ADMIN_TAKE_OVER_REQUESTS.sql` — takeover request table

---

## Run / Test

- **Local:** Open `teamridepro_v2.html` (main) or `teamridepro_v3.html` (v3-dev) in a browser. Supabase config is in `scripts/supabase-config.js`.
- **Local server:** `node server.js` (on main) or `cd server && node server.js` (on v3-dev)
- **Push to live (v2):** Commit and push to `main`. GitHub Pages rebuilds in 1-2 min. Hard refresh: `Ctrl+Shift+R`.

---

## Known Issues / Notes

1. **Strava route previews are disabled** — cross-origin iframes can't be captured automatically. Routes can use a manually-uploaded cached preview image.
2. **`app-main.js` is very large (~28,500+ lines)** — `docs/SPLIT_STRATEGY_TEAMRIDEPRO_V2.md` describes a further multi-file split (Option B) if editor stability is an issue.
3. **Folder rename pending** — local folder may still be `Team Practice Pro` instead of `TeamRide Pro`. User needs to close Cursor, rename in Explorer, and reopen via `TeamRide Pro.code-workspace`.
4. **Old workspace file** — `Team Practice Pro.code-workspace` may still exist on disk as an untracked file; safe to delete.

---

## Key Documentation

| Doc | Purpose |
|-----|---------|
| **docs/CHAT_HANDOFF.md** | Prior handoff (Feb 2025) — Phase 1 split, lockout bypass details |
| **docs/CHAT_SESSION_HANDOFF.md** | Older handoff (Jan 2025) — crash recovery, attendance fix |
| **docs/SPLIT_STRATEGY_TEAMRIDEPRO_V2.md** | HTML/JS split strategy; Option B for further splitting app-main.js |
| **docs/PROJECT_HANDOFF.md** | Broader project state, DNS/email, deploy |
| **docs/UPDATE_LIVE_SITE_WORKFLOW.md** | Deploy to GitHub Pages |
| **docs/FOLDER_ORGANIZATION.md** | Folder structure reference |

---

## If Continuing From Here

1. **v3 development:** Switch to `v3-dev` to start building new features. The v3 branch is fully set up with clean organization.
2. **v2 hotfixes:** Stay on `main` to fix urgent production issues without touching v3.
3. **Further code splitting:** If `app-main.js` causes editor performance issues, consider splitting into `app-routes-races.js`, `app-assignments.js`, etc. per `docs/SPLIT_STRATEGY_TEAMRIDEPRO_V2.md`.
4. **Folder rename:** If not yet done, close Cursor → rename `Team Practice Pro` to `TeamRide Pro` in Explorer → reopen `TeamRide Pro.code-workspace`.

---

*Handoff written February 13, 2026 for starting a new AI chat session.*
