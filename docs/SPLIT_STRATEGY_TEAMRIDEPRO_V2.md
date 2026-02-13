# Split Strategy: teamridepro_v2.html → External JS

**Goal:** Reduce single-file size to avoid editor/IDE (e.g. Cursor) instability while keeping the app behavior unchanged. The main file is ~30,260 lines; ~28,300 lines are a single inline `<script>`.

**Constraint:** No change to architecture (still one HTML entry point, SPA). All script runs in the same global scope and depends on load order of existing scripts (`supabase-config.js`, `auth.js`, `database.js`, `roles.js`).

---

## Current Structure (approximate)

| Lines    | Content |
|----------|--------|
| 1–133    | `<head>`, link to `styles.css`, first inline `<style>` block |
| 148–1922 | Body markup (tabs, modals, forms, headers) |
| 1923–30257| **Single inline `<script>`** (~28,335 lines) |
| 30258–30260| `</script></body></html>` |

The inline script contains **560+ functions** and shared globals (`data`, `isReadOnlyMode`, `adminEditLockInterval`, etc.). There are no ES modules; everything relies on globals and execution order.

**Section markers already in code:**

- `// ============ USERS MANAGEMENT ============` (10905)
- `// ============ BACKUP MANAGEMENT ============` (11288)
- `// ============ TAB STATE PERSISTENCE ============` (11504)
- `// ============ RIDE ASSIGNMENTS (MOBILE-FRIENDLY) ============` (27352)
- `// ============ COACH ASSIGNMENTS (MOBILE-FRIENDLY) ============` (27747)
- `// ============ COACH ASSIGNMENTS CONTEXT MENU ============` (28058)
- `// ============ ROUTES MANAGEMENT ============` (28311)
- `// ============ RACES MANAGEMENT ============` (29826)

There is also a **large template literal** (lines ~22482–22570+) that builds a full HTML document string for **group-assignments print/export**. It must stay inside the JS that has access to `escapeHtml`, ride/group data, and the function that uses `htmlContent`.

---

## Option A: Quick win — one external script (recommended first step)

**What:** Move the entire inline `<script>` body (lines 1924–30256) into a single external file, e.g. `scripts/app-main.js`. The HTML keeps one tag:

```html
<script src="scripts/app-main.js"></script>
```

**Result:**

- **teamridepro_v2.html** drops to **~1,925 lines** (markup + one script tag + optional small inline script if you leave a tiny bootstrap).
- **scripts/app-main.js** is ~28,300 lines — still large, but no longer mixed with HTML, so the editor only parses one language per file and the main “page” file is small.

**Pros:** Minimal risk, no dependency or order issues, one refactor pass.  
**Cons:** One very large JS file remains (can split later per Option B).

**Steps:**

1. Create `scripts/app-main.js` and paste the full script content (from the first line after `<script>` through the line before `</script>`).
2. In the HTML, remove the inline script block and add `<script src="scripts/app-main.js"></script>` after the existing script tags (e.g. after `roles.js`).
3. Test full flow: auth, lock/takeover, roster, rides, assignments, print/export, routes, races, backup, users.
4. Ensure no inline event handlers in HTML depend on script running “above” them (they run on click, so as long as app-main.js loads before first interaction, you’re fine).

---

## Option B: Multi-file split by feature (after Option A)

Split `app-main.js` into several files that load in a fixed order and rely on the same global scope. No `import`/`export`; load via `<script src="...">` order.

### Load order (critical)

Scripts must run in this order so that shared state and helpers exist before code that uses them:

1. **Existing:** `supabase-config.js` → `auth.js` → `database.js` → `roles.js`
2. **New (suggested order):**
   - `app-core.js` — global state and shared helpers
   - `app-auth-lock.js` — auth UI and admin edit lock / takeover
   - `app-data-load-save.js` — load/save, upgradeData, visibility/flush
   - `app-roster.js` — riders/coaches tables and modals
   - `app-rides-calendar.js` — rides, pasteboard, practice calendar, season settings
   - `app-assignments.js` — group/assignment rendering, drag-drop, validation, undo/redo
   - `app-print-export.js` — group-assignments HTML template and print/export
   - `app-users-backup.js` — users management, backup management
   - `app-routes-races.js` — routes and races management
   - `app-ui-tabs-mobile.js` — tab state, mobile menu, site settings, init entry
   - `app-init.js` — only `init();` (and anything that must run last)

Alternatively, the last “init” call can stay at the end of `app-ui-tabs-mobile.js` (or a single “app-boot.js”) instead of a separate file.

### Suggested file boundaries (approximate)

These are derived from section comments and logical groupings; exact line numbers will shift when you extract from the single script.

| File | Approx. content | Est. lines | Notes |
|------|------------------|------------|--------|
| **app-core.js** | `DEBUG_LOGS`, `data`, all “global” state (e.g. `practiceReportingRideIndex`, `groupSectionsState`, `isReadOnlyMode`, `adminEditLockInterval`, …). Helpers: `getFitnessScale`, `getSkillsScale`, `normalizePaceScaleOrder`, `getPaceScaleOrder`, `getGroupPaceComparator`, `getBikeSkillsTooltip`, `getAutoAssignSetting*`, `escapeHtml`, `upgradeData`, `generateId`, `normalizeCoachId`, `normalizeTimeValue`, `createGroup`, `computeGroupsInfo`, sample data constants (`DAYS_OF_WEEK`, `COACH_NAMES`, etc.), `buildDefaultSeasonSettings`, scale conversion helpers. | ~3,500 | Many other files call these; must load first. |
| **app-auth-lock.js** | Auth UI (showLogin, showAdminLogin, resetLoginButtonState, …), handleLogin, handleAuthStateChange, applyRoleBasedAccess, setReadOnlyMode, handleReadOnlyInteraction, showLockConflictDialog, initAdminEditLock, showTakeOverRequestPopup, releaseAdminEditLock, developer mode (enter/exit), setupAutoLogoutOnClose. | ~1,400 | Depends on core (data, getCurrentUser, etc.). |
| **app-data-load-save.js** | loadApplicationData, loadData, loadDataFromSupabase, saveData, flushPendingSaves, handleVisibilityChange, handleWindowFocus, saveRiderToDB, saveCoachToDB, debouncedSaveRide, saveRideToDB, showSaveError, STORAGE_KEY, upgradeData (if not in core). | ~1,200 | Heavy dependency on database.js and core. |
| **app-roster.js** | Roster tab: rider/coach tables, addRider, deleteRider, openEditRiderModal, saveRiderFromModal, addNewRiderToAttendanceLists, coach photo upload, rider photo upload, photo crop UI, group count selection, formatPhone*, rider/coach column defs, sort/group state, notes modal. | ~3,800 | Uses core, data load/save. |
| **app-rides-calendar.js** | Rides list, practice calendar, season settings UI, practice planner/picker, date range, createRideFromForm, ride CRUD, practice entry normalization, CSV import (if in this file). | ~4,500 | Large; may need to split “calendar” vs “rides list” later. |
| **app-assignments.js** | Pasteboard/assignments: renderRiderCardHtml, renderCoachCardHtml, renderAssignments, renderPracticeAttendanceLists, group validation, auto-assign, undo/redo, drag-drop, more/fewer groups, clearAssignments, showGroupValidationErrorModal, attendance lists, group color names. | ~6,500 | Depends on core and rides. |
| **app-print-export.js** | Function(s) that build the group-assignments HTML string (the big template literal starting ~22482), and any print/export triggers that use it. | ~1,500 | Must have access to escapeHtml, ride/group data, and assignment rendering helpers it references. |
| **app-users-backup.js** | Users management (USERS MANAGEMENT section), backup management (BACKUP MANAGEMENT section). | ~1,100 | Depends on core and auth. |
| **app-routes-races.js** | ROUTES MANAGEMENT, RACES MANAGEMENT. | ~2,000 | Depends on core and data. |
| **app-ui-tabs-mobile.js** | switchTab, toggleMobileMenu, updateMobileMenu, TAB STATE PERSISTENCE, season date range picker, site settings, any remaining “shell” UI. | ~2,000 | Depends on core. |
| **app-init.js** | init(), and optionally loadApplicationData + initAdminEditLock call from handleAuthStateChange (if not already in app-auth-lock). Ensure init() runs after all scripts load. | ~50 | Must run last. |

Total is only a rough guide; actual sizes will vary when you cut/paste. The important part is **order**: core → auth/lock → data → roster → rides/calendar → assignments → print/export → users/backup → routes/races → UI → init.

### Cross-file dependencies (summary)

- **Core** is the base: `data`, scale/pace helpers, `escapeHtml`, `upgradeData`, group helpers used everywhere.
- **Auth/lock** uses: getCurrentUser, getCurrentUserRole, signOut, handleAuthStateChange, and DOM for login/takeover.
- **Data load/save** uses: core `data`, database.js (getAllRiders, etc.), saveData.
- **Roster / Rides / Assignments** use: core, data load/save, and each other (e.g. assignments use ride and group helpers from core and rides).
- **Print/export** uses: core (escapeHtml, ride/group data), and the assignment/group rendering context (e.g. group labels, route display).
- **init()** calls loadApplicationData and wires auth; it must run after all of the above.

### Gotchas

1. **Global scope:** All files share `window`. No `let`/`const` at top level in a later file that shadows a name from an earlier file (e.g. don’t redeclare `data`).
2. **Template literal (print HTML):** The group-assignments HTML string (~22482–22570+) is inside one function. Keep that entire function in one file (e.g. app-print-export.js). That file must be loaded after any helpers it calls (escapeHtml, getRouteById, etc.), which will be in core or assignments.
3. **Inline handlers in HTML:** Many elements use `onclick="someFunction()"`. Those functions must exist on `window` when the user clicks. As long as all app-*.js files load before the user interacts, this is fine. If you ever lazy-load script, those handlers would need to be attached in JS instead of inline.
4. **init():** The current script ends with `init();`. That must run once, after every other script has run. So the last script in the HTML should be either the one that contains `init();` or a tiny script that only calls `init();`.

---

## Recommended implementation order

1. **Phase 1 (low risk):** Do **Option A** only — extract the full inline script to `scripts/app-main.js`, update HTML to reference it, test thoroughly. You get a much smaller HTML file and one large JS file.
2. **Phase 2 (optional):** If one 28k-line JS file is still problematic for the editor, split `app-main.js` into the files above in **Option B**, one at a time: e.g. first app-core.js (move a chunk of code, fix any references, test), then app-auth-lock.js, and so on. Always keep load order and run the app after each new file.
3. **Inline styles:** You can optionally move the first inline `<style>` block (lines 8–133) into e.g. `styles-overrides.css` and link it; that further shrinks the HTML and keeps styling in one place.

---

## HTML after Phase 1 (example)

```html
    <script src="scripts/supabase-config.js"></script>
    <script src="scripts/auth.js"></script>
    <script src="scripts/database.js"></script>
    <script src="scripts/roles.js"></script>
    <!-- ... other libs (jsPDF, Google, etc.) ... -->
    <script src="scripts/app-main.js"></script>
</head>
<body>
    ...
</body>
</html>
```

No inline `<script>` in the body; the only app script is `app-main.js`. After Phase 2, replace `app-main.js` with the ordered list of `app-*.js` files and keep `app-init.js` (or the file that calls `init()`) last.

---

## Summary

| Approach | HTML size | JS files | Risk | Effort |
|----------|-----------|----------|------|--------|
| **Option A** (single app-main.js) | ~1,925 lines | 1 new file (~28k lines) | Low | Low |
| **Option B** (multi-file) | ~1,925 lines | 10–11 new files (~2–6.5k each) | Medium (order/deps) | High |

Start with **Option A** for immediate relief and stability; introduce **Option B** only if you need smaller JS files for the editor.
