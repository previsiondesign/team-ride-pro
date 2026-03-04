# Comprehensive Handoff for Claude Code — TeamRide Pro

**Date:** March 2, 2026  
**Purpose:** Provide full context for a new AI agent (e.g. Claude Code): site functionality, organization (local + GitHub), script architecture, recent changes, and known issues requiring further work.

---

## 1. Project Overview

| Item | Detail |
|------|--------|
| **Name** | TeamRide Pro (Tam High MTB Team Roster & Practice Manager) |
| **Type** | Single-page web app (vanilla JS, no framework) |
| **Backend** | Supabase (Auth, Postgres, Edge Functions) |
| **Hosting** | GitHub Pages (serves from `main` branch) |
| **Local path** | `D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\TeamRide Pro` |
| **GitHub repo** | `previsiondesign/team-ride-pro` |
| **Live site** | https://previsiondesign.github.io/team-ride-pro/ |

**Entry point:** `index.html` redirects to `teamridepro_v3.html`, which is the main application. The app uses a **split script architecture** (multiple `app-*.js` modules), not a single monolithic file.

---

## 2. Local and GitHub Organization

### Branches and worktrees

| Branch | Purpose | Main HTML | Where to edit |
|--------|---------|-----------|----------------|
| **`main`** | Production (GitHub Pages) | `teamridepro_v3.html` (after redirect) | `TeamRide Pro\` folder |
| **`v3-dev`** | Development | `teamridepro_v3.html` | `TeamRide Pro v3\` folder (worktree) |

- **Worktrees:** Both branches can be checked out at once. `TeamRide Pro\` = `main`; `TeamRide Pro v3\` = `v3-dev`. Edit in the folder that matches the branch you want to push to.
- **v2 legacy:** `teamridepro_v2.html` exists and redirects to `teamridepro_v3.html`. Do not break the live site on `main`.
- **Deploy:** Push to `main` from `TeamRide Pro\` to update the live site (GitHub Pages rebuilds in 1–2 minutes).

### Important paths

- **Root:** `TeamRide Pro\` (or `TeamRide Pro v3\` for v3-dev)
- **Scripts:** `scripts/` (auth, database, roles, app-state, app-utils, app-main, app-rides, app-groups, etc.)
- **Styles:** `styles.css`, `styles-overrides.css`
- **SQL migrations:** `sql/` (run in Supabase SQL editor)
- **Docs:** `docs/` (handoffs, Supabase guides, troubleshooting)
- **Supabase:** `supabase/` (config, edge functions e.g. `send-verification-code`, `send-admin-invitation`, `approve-admin-request`)

---

## 3. Full Site Functionality

### Tabs / main areas

1. **Roster** — Riders and coaches: add/edit/archive, columns (name, pace, skills, climbing, grade, gender, etc.), sort/filter, CSV import/export, roles (rider/coach), scheduled absences.
2. **Rides (Practice Planner)** — Calendar of practices; create/edit/cancel/reschedule; set meet location, time, goals; **attendance** (available riders/coaches); **group assignments** (drag-and-drop riders/coaches into groups, add/delete/merge/split groups, reorder, routes per group, custom group names, color names from Supabase); **publish/unpublish** group assignments; auto-assign algorithm; undo/redo for assignments; e-bike vs manual per coach per ride; print/PDF rosters.
3. **Routes** — List of routes (name, start location, distance, elevation, Strava link/embed); add/edit (manual or Strava); assign routes to groups from route list; location filtering in practice planner dropdown.
4. **Assignments** — Read-only view of published group assignments (riders + coaches) for a selected practice; mobile-friendly layout.
5. **Season** — Season settings (dates, team name, fitness/skills scales, pace order, group color names toggle, coach/rider roles, time estimation settings); backup/restore (export/import JSON, save/restore to Supabase).
6. **Races** — Race events (add/edit, link to season).

### Auth and roles

- **Supabase Auth** + optional Google OAuth. Roles: coach-admin (full access), coach (limited), rider (read-only assignments). Simplified login (phone/email) for rider/coach views.
- **Admin edit lock:** One coach-admin can hold the edit lock; others see Read-Only, Request Access, or Developer Mode. Take-over request flow with Yes/No popup.
- **Developer mode:** Writes are no-op to Supabase; data is read from Supabase but saved only to localStorage (for safe testing).

### Data flow

- **Load:** On init, `loadDataFromSupabase()` (or fallback `loadData()` from localStorage) fetches riders, coaches, rides, routes, season settings, auto-assign settings, races, scheduled absences. Data lives in a global `data` object (and `app-state.js` if used).
- **Save:** Rides are updated via `saveRideToDB(ride)` (local `data.rides` + localStorage + Supabase `updateRide`). Riders/coaches/routes/settings use their own CRUD in `database.js`.

---

## 4. Script Architecture (Load Order)

Scripts are loaded in `teamridepro_v3.html` in this order:

| Order | File | Role |
|-------|------|------|
| 1 | `scripts/supabase-config.js` | Supabase client init |
| 2 | `scripts/auth.js` | Login, signOut, auth state |
| 3 | `scripts/database.js` | All Supabase CRUD (riders, coaches, rides, routes, season_settings, color_names, etc.); `buildRideDbData`, `mapRideDbToApp`, `getAllRides`, `updateRide`, etc. |
| 4 | `scripts/roles.js` | `getCurrentUserRole`, role checks |
| 5 | (jsPDF, Google APIs — CDN) | PDF export, Google Sheets (if used) |
| 6 | `scripts/app-state.js` | Shared state helpers if any |
| 7 | `scripts/app-utils.js` | Utilities (e.g. `escapeHtml`, date parsing, `isScheduledAbsent`) |
| 8 | `scripts/app-scales.js` | Fitness/skills scale UI and descriptions |
| 9 | `scripts/app-auth-handlers.js` | Auth UI, lock conflict, takeover, dev mode |
| 10 | `scripts/app-groups.js` | Group card UI, assign coach/rider to group, remove from group, card menus (“Move to group”, “Unassign”), `assignCoachToGroup`, `removeRiderFromGroups`, `removeCoachFromGroups` |
| 11 | `scripts/app-riders.js` | Roster riders tab, rider modal, rider list rendering |
| 12 | `scripts/app-coaches.js` | Roster coaches tab, coach modal |
| 13 | `scripts/app-rides.js` | Practice planner: calendar, ride list, **assignments view** (`renderAssignments`), group cards, route dropdown per group, publish/unpublish, clear/copy-from-prior/auto-assign, **color names** (`ensureGroupColorNames`, `toggleGroupColorNames`, `useGroupColorNamesEnabled`), **published-groups guard** (`confirmUnpublishForEdit`), try more/fewer groups, unassign all coaches, PDF/print |
| 14 | `scripts/app-season.js` | Season tab, backup/restore, export/import |
| 15 | `scripts/app-csv.js` | CSV import/export |
| 16 | `scripts/app-sidebar.js` | Practice sidebar (attendees, unassigned riders/coaches, drag sources) |
| 17 | `scripts/app-routes.js` | Routes tab, route list, add/edit route modal, assign route to groups dialog |
| 18 | `scripts/app-races.js` | Races tab |
| 19 | `scripts/app-assignments.js` | Assignments tab (read-only published view) |
| 20 | `scripts/app-main.js` | Main orchestrator: init, tab switching, **drag-and-drop** (`drop`, `handleRiderDrop`, `handleCoachDrop`), **toggleRiderAvailability** / **toggleCoachAvailability**, **moveRiderBetweenGroups**, **moveCoachToRole** / **moveCoachToGroup**, **updateGroupRoute**, **executeRenameGroup**, delete/merge/split group, add group, reorder groups, **confirmEditPastPractice**, welcome screen, practice menu, etc. |

Many functions are global (e.g. `confirmUnpublishForEdit`, `saveRideToDB`, `renderAssignments`, `ensureGroupColorNames`) and are called across modules.

---

## 5. Database (Supabase) — Summary

- **Tables:** `riders`, `coaches`, `rides`, `routes`, `races`, `season_settings`, `auto_assign_settings`, `color_names`, `rider_feedback`, `ride_notes`, `rider_availability`, `backups`, `admin_edit_locks`, `admin_take_over_requests`, `admin_invitations`, `admin_disabled_users`, plus scheduled absences if applicable.
- **Rides:** `rides` has `groups` (JSONB), `available_riders`, `available_coaches`, `published_groups`, `settings` (JSONB). Extra ride-level data (e.g. `availableRiders`, `_groupColorNames`, `_groupColorNamesByIndex`, `coachBikeMode`) is stored in `settings` by `buildRideDbData` and restored in `mapRideDbToApp`.
- **Color names:** `color_names` table (e.g. id, name, sort_order) is read by `getColorNames()` in `database.js` and used when “Color names” is enabled for groups (assign labels like “Red”, “Blue” from that list).

---

## 6. Recent Changes and Updates (Pre–March 2026)

### Published-groups warning

- **Intent:** When groups are published (`ride.publishedGroups === true`), any edit that changes assignments or group structure should prompt: *“Current groups have been published, do you want to unpublish them for editing?”* OK = unpublish and proceed; Cancel = abort.
- **Helper:** `confirmUnpublishForEdit(ride)` in `app-rides.js`. If `ride.publishedGroups` is true, shows the confirm; on OK sets `ride.publishedGroups = false`, `saveRideToDB(ride)`, and `updateRide(ride.id, { publishedGroups: false, groups: ride.groups })`; returns true/false.
- **Guards added in:**  
  - **app-main.js:** `drop()` (drag into group), `addGroup`, `deleteGroup`, `mergeGroups`, `splitGroup`, `moveGroupBefore`, `moveGroupToEnd`, `applyReorderGroups`, `moveRiderBetweenGroups`, `moveCoachToRole`, `moveCoachToGroup`, `updateGroupRoute`, `executeRenameGroup`, `toggleCoachBikeMode`, `toggleRiderAvailability`, `toggleCoachAvailability`.  
  - **app-rides.js:** `clearAssignments`, `clearAllAndRestartPlanning`, `copyGroupsFromPriorPractice`, `autoAssign`, `unassignAllCoaches`, `tryMoreGroups`, `tryFewerGroups`, `toggleGroupColorNames`.  
  - **app-groups.js:** `assignCoachToGroup`, and card menu handlers for “Move to [group]” / “Unassign” (riders and coaches) and coach role swap.  
  - **app-routes.js:** Route-assign dialog “Apply” button (assigning route to groups).

### Route area in group cards

- Route selector bar in practice planner group cards is **blue** (`#1976d2`) with **white text** (in `app-rides.js` template + `styles.css`).
- In the route dropdown, the **currently selected route** has class `route-option-selected` and is styled blue with white text for reference (`styles.css`: `.route-dropdown-option.route-option-selected`).

### Color names (group labels from Supabase)

- **Intent:** Optional “Color names” (season setting) uses labels from Supabase `color_names` table for each group (e.g. “Red Group”, “Blue Group”). Once assigned, they should **stay fixed** (no change on refresh).
- **Implemented so far:**  
  - **database.js:** When saving a ride, `buildRideDbData` writes `_groupColorNames` (map by group id) and `_groupColorNamesByIndex` (array by group index) into `ride.settings`. On load, `mapRideDbToApp` restores `group.colorName` from `row.settings._groupColorNames` (by id) or `row.settings._groupColorNamesByIndex` (by index).  
  - **app-rides.js:** `ensureGroupColorNames(ride)` assigns a `colorName` to groups that don’t have one, using a **shuffled** list from `getColorNames()` so each practice gets a random order from the Supabase list. A previous “rehydrate” that ran on every `renderAssignments` and reassigned missing color names was **removed** so that names do not change on every refresh.
- **Current problem:** Color names are **still not persisting correctly** after refresh. The checkmark for “Color names” remains on in the menu, but the actual group color names are lost. This needs further debugging (e.g. whether `settings` or `groups` are persisted/returned correctly by Supabase, or whether another code path overwrites/strips them).

---

## 7. Known Issue: Color Groups — Needs Further Work

**Status:** Unresolved.

**Observed behavior:** After enabling “Color names” and assigning names to groups, a page refresh (or reload from Supabase) causes the group color names to disappear while the “Color names” menu checkmark remains on.

**What’s in place:**

- Persist: `buildRideDbData` in `database.js` adds `_groupColorNames` and `_groupColorNamesByIndex` to `ride.settings` when saving.
- Restore: `mapRideDbToApp` in `database.js` restores `g.colorName` from `row.settings._groupColorNames` (by `g.id`) or `row.settings._groupColorNamesByIndex` (by index).
- No re-assignment on render: The rehydrate block that called `ensureGroupColorNames` and `saveRideToDB` inside `renderAssignments` was removed so that once assigned, names are not overwritten.

**Likely areas to investigate:**

1. **Supabase:** Does the `rides` row returned by `getAllRides()` / `select('*')` include `settings` with `_groupColorNames` and `_groupColorNamesByIndex`? (RLS, column selection, or JSONB merge could affect this.)
2. **Writes:** Does `updateRide` send the full `settings` object including those keys? Is the `settings` column being replaced or merged on update?
3. **Load path:** When loading from Supabase, is `mapRideDbToApp` applied to every ride? When loading from localStorage, are `data.rides` and each `ride.groups[].colorName` preserved?
4. **Id vs index:** Group `id` might be missing or different after a round-trip; the by-index fallback should help but may need verification (e.g. logging `row.settings` and `result.groups` in `mapRideDbToApp`).

**Request for next developer:** Reproduce the issue (enable color names, assign, refresh), then trace where `colorName` or `_groupColorNames*` is lost (DB payload, mapRideDbToApp, or later overwrite) and fix persistence/restore so that color names stay fixed after refresh.

---

## 8. Key Files Quick Reference

| Concern | Primary files |
|--------|----------------|
| Ride save/load, group + settings mapping | `scripts/database.js` (`buildRideDbData`, `mapRideDbToApp`, `updateRide`, `getAllRides`) |
| Color names logic | `scripts/app-rides.js` (`ensureGroupColorNames`, `useGroupColorNamesEnabled`, `toggleGroupColorNames`), `scripts/database.js` (persist/restore above) |
| Published-groups warning | `scripts/app-rides.js` (`confirmUnpublishForEdit`), then all call sites in app-main, app-rides, app-groups, app-routes |
| Practice planner UI | `scripts/app-rides.js` (`renderAssignments`, group cards, route dropdown), `scripts/app-groups.js` (group card content, coach/rider menus) |
| Drag-drop, attendance toggles | `scripts/app-main.js` (`drop`, `handleRiderDrop`, `handleCoachDrop`, `toggleRiderAvailability`, `toggleCoachAvailability`) |
| Route list and assign dialog | `scripts/app-routes.js` |
| Styles (route bar, selected option) | `styles.css` (e.g. `.route-selector-trigger`, `.route-option-selected`) |

---

## 9. Run / Test

- **Local:** Open `teamridepro_v3.html` in a browser (or use a local server from project root or `server/`).
- **Supabase:** Same project for both branches; config in `scripts/supabase-config.js`.
- **Push to live:** Commit and push to `main` from `TeamRide Pro\`; hard refresh (e.g. Ctrl+Shift+R) after deploy.

---

## 10. Related Docs

- **docs/HANDOFF_FEB_2026.md** — Earlier handoff (v2/v3 branch layout, worktrees, route/backup/admin lock changes).
- **docs/FOLDER_ORGANIZATION.md** — Folder structure.
- **docs/UPDATE_LIVE_SITE_WORKFLOW.md** — Deploy to GitHub Pages.
- **docs/DEVELOPMENT.md** — Development guide.
- **sql/database-schema.sql** — Schema reference.

---

*Handoff written March 2, 2026 for Claude Code. Includes full functionality, organization, script layout, recent changes, and explicit note that color group persistence is still unsuccessful and needs further work.*
