# Chat Session Handoff — Pick Up on New Machine

**Date**: 2025-01-23  
**Use**: Open this when continuing work on a different machine or in a new chat.

---

## Project

- **Name**: Team Practice Pro (Tam High MTB Team Roster & Practice Manager)
- **Path**: `D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro`
- **Main app**: `teamridepro_v2.html` (~29,158 lines) — single-file HTML with inline CSS/JS, loads `scripts/supabase-config.js`, `auth.js`, `database.js`, `roles.js`
- **Live site**: https://previsiondesign.github.io/team-ride-pro/teamridepro_v2.html  
- **Repo**: `previsiondesign/team-ride-pro` (GitHub Pages from `main`)

---

## What Was Done This Session

1. **Crash recovery**
   - `teamridepro_v2.html` had been truncated mid-function (`saveRiderFromModal`). User restored from cloud backup; that version is what’s in the repo.

2. **“New riders not in attendance” fix**
   - **Behavior**: Manually added riders (Roster “Add” or Add Team Rider modal) did not appear in practice attendance lists.
   - **Change**: New rider IDs are now added to `ride.availableRiders` for all non-deleted rides when a rider is created.
   - **Code**:
     - `addNewRiderToAttendanceLists(newRiderId)` — loops `data.rides`, skips `ride.deleted`, appends `newRiderId` to `ride.availableRiders` if missing, calls `saveRideToDB(ride)`.
     - `addRider()` — uses `saveRiderToDB` return; if `added && added.id`, calls `addNewRiderToAttendanceLists(added.id)`, `renderPracticeAttendanceLists()`, and `renderAssignments(r)` when `data.currentRide` is set.
     - `saveRiderFromModal()` — same for create path only (`added && added.id`); edits do not change attendance.

3. **Push to live**
   - Latest push: commit `Add: New riders automatically added to all practice attendance lists` on `main`. Live site should reflect this after GitHub Pages rebuild (1–2 min). Hard refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`.

---

## Run / Test Locally

- Open `teamridepro_v2.html` in a browser (file or via a local server).  
- For Supabase/DB: ensure `scripts/supabase-config.js` (and any env) is set for your environment.  
- For “push to live”: see `docs/UPDATE_LIVE_SITE_WORKFLOW.md`.

---

## Git State (as of handoff)

- **Pushed**: `teamridepro_v2.html` (new-rider-to-attendance) is committed and pushed to `main`.
- **Modified, not committed**: `Team Practice Pro.code-workspace`, `docs/EDGE_FUNCTION_SEND_VERIFICATION_CODE.md`, `docs/VERIFICATION_SETUP_STEPS.md`, `docs/supabase/COMPREHENSIVE_DATA_SYNC_REVIEW.md`, `scripts/database.js`, `scripts/roles.js`, `sql/database-schema.sql`.
- **Untracked**: `csv/Jan22_Updates/`, `package-lock.json`, several `sql/ADD_*.sql` migrations, `supabase/functions/send-verification-code/`, `temp/` backups.

Quick push for `teamridepro_v2.html` only:

```bash
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"
git add teamridepro_v2.html
git commit -m "Your message"
git push origin main
```

---

## Where to Look in the Code

- **Roster / riders**: `addRider()`, `saveRiderFromModal()`, `saveRiderToDB()`, `deleteRider()`, `addNewRiderToAttendanceLists()`.
- **Attendance**: `ride.availableRiders`, `ride.availableCoaches`; `renderPracticeAttendanceLists()`, `renderAssignments(ride)`.
- **Ride CRUD**: `saveRideToDB()`, `debouncedSaveRide()`.
- **Auth / roles**: `scripts/auth.js`, `scripts/roles.js`; `handleAuthStateChange`, `loadApplicationData`, `canEditRiders()`.
- **DB**: `scripts/database.js` — `getAllRides`, `getAllRiders`, `createRider`, `updateRider`, `updateRide`, etc.

---

## Useful Docs

| Doc | Purpose |
|-----|---------|
| `docs/UPDATE_LIVE_SITE_WORKFLOW.md` | Deploy to GitHub Pages |
| `docs/DEVELOPMENT.md` | Dev setup |
| `docs/README.md` | Project overview |
| `sql/` | Migrations (run in Supabase SQL Editor when needed) |

---

## If Continuing From Here

- **Roster/attendance**: Logic is in place; any new “add rider” paths should also call `addNewRiderToAttendanceLists(createdId)` when appropriate.
- **Uncommitted changes**: Decide whether to commit `scripts/database.js`, `scripts/roles.js`, `sql/database-schema.sql`, and docs; `temp/` and `package-lock.json` are often left out.
- **Deploy**: After edits to `teamridepro_v2.html` (or other tracked app files), use `git add` → `commit` → `push origin main` and then hard-refresh the live URL.

---

*Handoff written 2025-01-23 for pickup on a different machine.*
