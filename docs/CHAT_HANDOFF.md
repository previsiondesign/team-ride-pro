# Chat Handoff — Team Practice Pro

**Date:** February 2025  
**Use:** Open this when starting a **new chat** or switching machines so the next session has full context.

---

## Project

- **Name:** Team Practice Pro (Tam High MTB Team Roster & Practice Manager)
- **Path:** `D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro`
- **Live site:** https://previsiondesign.github.io/team-ride-pro/teamridepro_v2.html
- **Repo:** `previsiondesign/team-ride-pro` (GitHub Pages from `main`)

Single-page app: roster, practice scheduling, group assignments, routes (Strava), attendance, admin/users, backup. Tech: vanilla JS, Supabase (Auth + DB + Edge Functions), GitHub Pages.

---

## Current File Structure (after Phase 1 split)

| File | Role |
|------|------|
| **teamridepro_v2.html** | Main entry (~1,800 lines). Markup only; links to CSS and JS. No inline `<style>` or `<script>`. |
| **scripts/app-main.js** | All app logic (~28,300 lines). Loaded at end of body. Depends on supabase-config, auth, database, roles. |
| **scripts/supabase-config.js** | Supabase client init |
| **scripts/auth.js** | Auth (login, signOut, handleAuthStateChange, etc.) |
| **scripts/database.js** | DB wrappers (riders, coaches, rides, routes, admin_edit_locks, admin_take_over_requests, etc.) |
| **scripts/roles.js** | Role helpers (getCurrentUserRole, canViewRoutes, etc.) |
| **styles.css** | Main styles |
| **styles-overrides.css** | Overrides: unavailable rider, pasteboard grid, divider, practice planner buttons. Linked in head after styles.css. |

**Load order:** Head: styles.css → styles-overrides.css → Supabase + auth + database + roles + jsPDF + Google APIs. Body (end): `app-main.js`.

---

## What Was Done Recently (this and prior sessions)

### Phase 1 split + styles (Feb 2025)
- Inline `<script>` (~28,335 lines) moved to **scripts/app-main.js**.
- Head inline `<style>` moved to **styles-overrides.css**.
- **teamridepro_v2.html** reduced from ~30,260 to ~1,800 lines to improve editor stability.

### Lockout bypass (admin edit lock + takeover)
- When a second coach-admin logs in while another has the “edit lock,” they see a **3-button dialog**: Read-Only, Request access from [name], Developer Mode.
- **Requester:** “Request access” creates a take-over request and shows “Waiting for response…” with a **Cancel** button. If lock holder grants (or 30s auto-grant), requester gets the lock; if denied, stays read-only with optional message.
- **Lock holder:** Popup “X is requesting access. Will you allow them to log you out?” with **Yes** / **No** (No requires a reason). **30s countdown** auto-grants if no response. Lock holder **cannot dismiss** the popup without answering (backdrop click blocked, beforeunload warning).
- If lock holder is logged out (manual Yes or 30s), sign-in page shows: **“You were logged out by [X] on [date/time].”**
- **DB:** `admin_edit_locks`, `admin_take_over_requests` (see `sql/ADD_ADMIN_EDIT_LOCKS.sql`, `sql/ADD_ADMIN_TAKE_OVER_REQUESTS.sql`). Logic in **app-main.js** (initAdminEditLock, showLockConflictDialog, showTakeOverRequestPopup, releaseAdminEditLock) and **database.js** (getAdminEditLock, upsertAdminEditLock, clearAdminEditLock, getTakeOverRequest, createTakeOverRequest, respondToTakeOverRequest).

### Earlier (from CHAT_SESSION_HANDOFF / PROJECT_HANDOFF)
- New riders auto-added to all practice attendance lists (`addNewRiderToAttendanceLists`).
- Admin invitation email (Edge Function; DNS/Resend setup may be pending).
- Strava route previews: currently **disabled** or capped to avoid iframe load; routes can use **cached preview image** (file upload). Automatic “capture preview” from a popup is **not possible** in the browser (cross-origin iframe); manual screenshot + upload or a backend screenshot service is the way.

---

## Where to Look in the Code

- **Lock / takeover:** `app-main.js` — `showLockConflictDialog`, `showTakeOverRequestPopup`, `initAdminEditLock`, `releaseAdminEditLock`, `setReadOnlyMode`. HTML: `#lock-conflict-overlay`, `#take-over-request-overlay`.
- **Auth / login:** `app-main.js` — `handleAuthStateChange`, `showAdminLogin`, `handleLogin`; `scripts/auth.js`.
- **Roster:** `app-main.js` — `addRider`, `saveRiderFromModal`, `addNewRiderToAttendanceLists`, roster table rendering.
- **Rides / assignments:** `app-main.js` — `renderAssignments`, `updateRoutePreviews`, `saveRideToDB`, practice calendar.
- **Routes:** `app-main.js` — route list, add/edit route modal, `cachedPreviewDataUrl`, `onRouteCachedPreviewFileChange`; `database.js` route CRUD.
- **DB / lock tables:** `scripts/database.js` — admin edit lock and take-over request functions; `sql/ADD_ADMIN_*.sql`.

---

## Key Docs

| Doc | Purpose |
|-----|--------|
| **docs/SPLIT_STRATEGY_TEAMRIDEPRO_V2.md** | How the HTML/JS split was done; Option B multi-file split if app-main.js is still too large. |
| **docs/PROJECT_HANDOFF.md** | Broader project state, DNS/email, deploy. |
| **docs/UPDATE_LIVE_SITE_WORKFLOW.md** | Deploy to GitHub Pages. |
| **docs/CHAT_SESSION_HANDOFF.md** | Older handoff (Jan 2025); new-rider attendance, crash recovery. |

---

## Run / Test

- Open **teamridepro_v2.html** in a browser (file or local server). Ensure `scripts/supabase-config.js` (and env) is set for your environment.
- Test: login, lock conflict (two coach-admins), request access / cancel / grant / deny, 30s auto-grant, read-only and developer mode, roster, rides, assignments, routes (cached preview upload), print/export.

---

## Git / Deploy

- After editing **teamridepro_v2.html**, **scripts/app-main.js**, or **styles-overrides.css**, commit and push to `main` for GitHub Pages. Hard refresh on live site.
- Ensure **sql/ADD_ADMIN_EDIT_LOCKS.sql** and **sql/ADD_ADMIN_TAKE_OVER_REQUESTS.sql** have been run in Supabase if using lock/takeover.

---

## If Continuing From Here

- **Phase 2 split:** If **app-main.js** is still heavy for the editor, see **docs/SPLIT_STRATEGY_TEAMRIDEPRO_V2.md** Option B (multiple app-*.js files in a fixed load order).
- **Strava previews:** Automatic capture of the Strava iframe in a popup is not possible (cross-origin). Use manual screenshot + cached preview upload, or a backend screenshot service.
- **Uncommitted / new files:** `styles-overrides.css`, `scripts/app-main.js`, and the reduced **teamridepro_v2.html** may be uncommitted; decide what to commit and push.

---

*Handoff written for starting a new chat or picking up on another machine.*
