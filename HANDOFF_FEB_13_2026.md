# TeamRide Pro v3 — Session Handoff (Feb 13, 2026)

## Overview

This session focused on a major **Practice Planner UI/UX overhaul** plus several bug fixes across the application. All changes are uncommitted on the `v3-dev` branch.

---

## Changes Made (This Session)

### 1. Skill Badge Color Spectrums
**File:** `styles.css`

Replaced the old badge color classes with distinct color spectrums per skill:
- **Endurance** (`.badge-pace-*`): Blue spectrum — lightest/slowest to darkest/fastest
- **Climbing** (`.badge-climbing-*`): Orange spectrum
- **Descending** (`.badge-skills-*`): Green spectrum
- 10 levels each, darker = better ranking

### 2. Unassigned Rider/Coach Indicators
**Files:** `app-sidebar.js`, `app-groups.js`, `styles.css`

- Unassigned riders/coaches show an **orange "?" badge** (same size as blue group numbers)
- Clicking the `?` badge opens a context menu listing all groups under "Assign to:" header
- Unassigned card names use `font-weight: 500` via `.unassigned-card` class

### 3. Group Badge Context Menu (Sidebar)
**Files:** `app-groups.js` (`showGroupBadgeMenu`), `styles.css`

- Clicking a **group number** in the sidebar opens a context menu with:
  - "Move to Group X" for every other group
  - "Unassign" option (red)

### 4. Global Sort/Skills Toolbar
**Files:** `app-rides.js`, `app-main.js`, `styles.css`

- **Removed** per-group sort dropdowns from group headers
- **Added** a global toolbar bar above the groups grid with:
  - "Sort by" dropdown (Endurance, Descending, Climbing, Grade, Gender, Name)
  - "Show Skills" checkboxes with icons: ❤ Endurance, ◢ Climbing, ◣ Descending
  - Skill labels added next to icons
- Sort affects all groups via `ride.globalGroupSort`
- Skill visibility via `ride.visibleSkills` array
- Functions: `changeGlobalGroupSort()`, `toggleSkillVisibility()`

### 5. Multi-Badge Rendering
**Files:** `app-groups.js` (`renderRiderCardHtml`, `renderCoachCardHtml`)

- Both functions accept `visibleSkills` array parameter
- Multiple selected skill badges render horizontally in `.badge-row-inline` flex container
- Badges right-aligned with `margin-left: auto`

### 6. Compact Group Error Headers
**Files:** `app-rides.js`, `app-main.js`, `styles.css`

- **Removed** red styling from non-compliant groups
- Non-compliant groups show a **subtle ⚠ icon** (clickable) in the header
- Clicking ⚠ opens a positioned popup with validation warnings
- Full compliance warnings appear on **print/publish** only
- Function: `showGroupWarningPopup()`

### 7. Hamburger Menu on Cards
**Files:** `app-groups.js` (`showCardMenu`), `styles.css`

- Every rider/coach card **within groups** has a ☰ button at the far right
- Opens context menu with:
  - "Move to Group X" for all other groups
  - **For coaches:** "Assign as [role]" options for role swapping
  - "Unassign" (red)
- CSS: `.card-menu-btn` with `order: 10` to ensure rightmost positioning

### 8. Coach Role Badges Repositioned
**Files:** `app-groups.js`, `styles.css`

- Leader/Sweep/Roam badges moved to **right side**, after the hamburger menu
- Fixed-width (52px) `.coach-role-badge-fixed` for vertical alignment

### 9. Group Visual Improvements
**Files:** `app-rides.js`, `styles.css`

- Group card background: `#b8b8b8` (darker grey) for contrast
- Coach sections have equalized `min-height` so **rider lists align horizontally**
- Dynamic rider section label reflects current sort (e.g., "8 riders, Endurance 1-3")

### 10. +/− Buttons in Roster
**Files:** `app-riders.js`, `app-coaches.js`, `styles.css`

- Changed ▲/▼ arrows to circled **+/−** buttons for all three skills
- CSS: `.pace-arrow` as 22px round circles, blue border, hover fills blue

### 11. Team Name Flash Fix
**Files:** `teamridepro_v3.html`, `app-main.js`

- Header starts `visibility: hidden` to prevent flash of wrong font/old name
- `applyTeamName()` sets `visibility: visible` after correct name loads

### 12. Database Schema Fixes
**File:** `database.js`

- **Safe column filtering**: `RIDER_SAFE_COLUMNS`, `COACH_SAFE_COLUMNS` sets + `filterSafeColumns()`
- Prevents "Could not find column X in schema cache" errors
- Unknown fields stored in `extra_data` JSONB column

### 13. Rating Scale Settings Fix
**Files:** `database.js`, `app-main.js`

- Fixed `mapSeasonDbToApp()` reading wrong column names (`fitness_scale` vs `endurance_scale`)
- Added missing `climbingScale` to save and load paths
- Fixed `paceScaleOrder` column reference

---

## Files Modified (Uncommitted)

### Tracked (modified):
| File | Key Changes |
|------|-------------|
| `scripts/app-main.js` | Global sort functions, team name flash fix, rating scale fixes, warning popup, dynamic labels |
| `scripts/database.js` | Safe column filtering, rating scale column name fixes, climbingScale |
| `styles.css` | Badge colors, toolbar, menus, +/- buttons, group styling, badge alignment |
| `teamridepro_v3.html` | Team name visibility hidden, Outfit font |
| `styles-overrides.css` | Font size bumps |

### Untracked (new files from JS splitting):
| File | Purpose |
|------|---------|
| `scripts/app-groups.js` | Group rendering, card menus, badge menus, coach role management |
| `scripts/app-sidebar.js` | Sidebar list rendering, unassigned badges |
| `scripts/app-rides.js` | Ride/group rendering, global toolbar, group cards |
| `scripts/app-riders.js` | Rider roster, badge click handlers, +/- buttons |
| `scripts/app-coaches.js` | Coach roster, +/- buttons |
| `scripts/app-assignments.js` | Assignment rendering |
| `scripts/app-auth-handlers.js` | Auth, auto-logout |
| `scripts/app-csv.js` | CSV import/export |
| `scripts/app-races.js` | Race management |
| `scripts/app-routes.js` | Route management |
| `scripts/app-scales.js` | Scale utilities |
| `scripts/app-season.js` | Season settings |
| `scripts/app-state.js` | Shared state variables |
| `scripts/app-utils.js` | Utility functions |

---

## Pending SQL Migrations

Run against Supabase if not already done:
1. `sql/ADD_TEAM_NAME_TO_SEASON_SETTINGS.sql`
2. `sql/ADD_V3_SKILL_CATEGORIES.sql`
3. `sql/ADD_NICKNAME_AND_BIKE_FIELDS.sql`

---

## Architecture Notes

- **Global sort**: `ride.globalGroupSort` on each ride object, saved via `saveRideToDB(ride)`
- **Visible skills**: `ride.visibleSkills` array (e.g., `['pace', 'climbing']`), on ride object
- **Card menus** in `app-groups.js`:
  - `showGroupBadgeMenu(event, type, id)` — sidebar group number click
  - `showUnassignedBadgeMenu(event, type, id)` — sidebar ? badge click
  - `showCardMenu(event, type, id, currentGroupId)` — hamburger menu in groups
- **Safe DB writes**: `filterSafeColumns(obj, safeSet)` in `database.js` strips unknown columns
- **Rating scales**: `mapSeasonDbToApp()` reads `endurance_scale`/`descending_scale`/`climbing_scale` with fallbacks

---

## Post-Crash Continuation Updates (Latest)

### 14. Roster Name Format Includes Nickname
**Files:** `scripts/app-riders.js`, `scripts/app-coaches.js`

- Roster name cells now show `Name (Nickname)` when nickname exists.
- Applied to both rider and coach roster table renderers.

### 15. Welcome Screen + Shortcut Launcher
**Files:** `teamridepro_v3.html`, `styles.css`, `scripts/app-main.js`

- Added startup welcome screen with greeting:
  - `Good morning/afternoon/evening [User], what would you like to do?`
- Added large shortcut buttons:
  - Plan the next practice → `rides`
  - Add or edit practice routes → `routes`
  - View/update rosters → `roster`
  - Go to the full site → restore last active tab
- Added `Don't show this welcome screen` checkbox on the welcome panel.
- Added Settings toggle:
  - `Show welcome screen with shortcut options` (user-specific preference).

### 16. Per-User Preference Sync (Cross-Device)
**Files:** `scripts/database.js`, `scripts/app-main.js`, `RUN_NOW_USER_PREFERENCES.sql`

- Added DB helper functions in `database.js`:
  - `getUserPreference(prefKey)`
  - `setUserPreference(prefKey, prefValue)`
- Preferences synced to Supabase:
  - `showWelcomeScreen`
  - `lastActiveTab`
- Added migration script:
  - `RUN_NOW_USER_PREFERENCES.sql`
  - Creates `public.user_preferences`
  - Adds RLS policies for owner read/write only.

### 17. Preference Save Failures Are Now User-Visible
**File:** `scripts/app-main.js`

- Preference sync failures no longer fail silently.
- User sees explicit warning when Supabase preference writes fail.
- Alerts are throttled (60s per preference) to avoid spam on rapid tab changes.

### 18. Safe Schema Patch Script Added
**File:** `RUN_NOW_V3_SAFE_SCHEMA_PATCH.sql`

- Consolidated additive migration script for v3 fields (safe for v2 compatibility).
- Updated to avoid `COALESCE` type mismatch by using string literals where needed.

---

## Current Known Issues / In-Progress

1. **Startup flash before welcome screen**
   - User reports app briefly shows an unloaded Season Dashboard before welcome overlay appears.
   - Needs startup rendering/auth flow adjustment to avoid interim tab paint.

2. **Auto sign-out on browser close regressed**
   - User reports closing tab/browser does not force sign-out on reopen.
   - Auto-logout path requires further debugging/repair in auth startup lifecycle.

3. **Cursor instability (OOM crashes)**
   - Still occurring even with extensions disabled.
   - Workaround state: use minimal window, avoid restored editor sets, run small edit batches.

---

## Additional SQL To Run

In addition to earlier migration files, run:

4. `RUN_NOW_V3_SAFE_SCHEMA_PATCH.sql`
5. `RUN_NOW_USER_PREFERENCES.sql`

---

## Updated Handoff Status

- Core welcome + preference sync implementation is in place.
- User-visible Supabase save warnings for preferences are in place.
- Two behavior regressions remain open (startup flash + browser-close auto sign-out).
