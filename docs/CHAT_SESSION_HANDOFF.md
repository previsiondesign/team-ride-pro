# Chat Session Handoff - Live Site Issues Fix

**Date**: Current Session  
**Status**: Fixes Completed - Ready for Testing  
**Priority**: High - Production Issues

---

## Issues Reported

The user reported three critical issues with the live GitHub Pages site:

### 1. Rider/Coach Pace and Skills Settings Not Persisting
- **Symptom**: When changing rider/coach pace and skills settings, they appeared to save during the session but were completely lost after logout/login
- **Impact**: All pace and skills adjustments were lost, requiring re-entry

### 2. RLS Error for New Users
- **Symptom**: New users logging in received error: "new row violates row-level security policy for table 'season_settings'"
- **Impact**: New users couldn't use the app properly, global settings couldn't be saved

### 3. Default Photos Not Showing
- **Symptom**: Some rider/coach default photos do not show up on the live site
- **Impact**: Missing profile photos for users without uploaded photos

---

## Root Causes Identified

### Issue 1: Missing Database Column & Incorrect Save Flow
- The `skills` column was missing from both `riders` and `coaches` tables
- The `adjustRiderPace()`, `adjustRiderSkills()`, `adjustCoachPace()`, and `adjustCoachSkills()` functions were calling `saveData()` which only saves season settings, auto-assign settings, and races - NOT individual riders/coaches
- Database functions weren't handling the `skills` field even though it existed in the app's data structure

### Issue 2: Missing Permission Checks
- `saveData()` was attempting to save season settings without checking if the user had the `coach-admin` role
- New users without roles couldn't create/update `season_settings` due to RLS policies
- No graceful error handling for permission-denied scenarios

### Issue 3: Assets Folder Not Verified
- Default photo paths are correct (`assets/male_default.png`, etc.)
- Assets folder needs to be verified as committed to git for GitHub Pages

---

## Fixes Applied

### 1. Added Skills Column Support

**SQL Migration Created**:
- `sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql`
  - Adds `skills TEXT DEFAULT '3'` column to `riders` table
  - Adds `skills TEXT DEFAULT '3'` column to `coaches` table
  - Adds column comments for documentation

**Database Functions Updated** (`scripts/database.js`):
- `getAllRiders()` - Now maps `skills` field from database
- `getRiderById()` - Now maps `skills` field from database
- `createRider()` - Now includes `skills` in insert mapping
- `updateRider()` - Now includes `skills` in update mapping
- `getAllCoaches()` - Now maps `skills` field from database
- `getCoachById()` - Now maps `skills` field from database
- `createCoach()` - Now includes `skills` in insert (passes through)
- `updateCoach()` - Now includes `skills` in update (passes through)

**Frontend Functions Updated** (`teamridepro_v2.html`):
- `saveRiderToDB()` - Now includes `skills: riderData.skills || '3'` in database mapping
- `saveCoachToDB()` - Now includes `skills: coachData.skills || '3'` in database mapping
- `adjustRiderPace()` - Changed from calling `saveData()` to calling `await saveRiderToDB(rider)` directly
- `adjustRiderSkills()` - Changed from calling `saveData()` to calling `await saveRiderToDB(rider)` directly
- `adjustCoachPace()` - Changed from calling `saveData()` to calling `await saveCoachToDB(coach)` directly
- `adjustCoachSkills()` - Changed from calling `saveData()` to calling `await saveCoachToDB(coach)` directly
- Made all adjust functions `async` since they now call async save functions

### 2. Fixed RLS Error Handling

**Frontend Function Updated** (`teamridepro_v2.html` - `saveData()`):
- Added permission check using `hasRole('coach-admin')` before attempting to save season settings, auto-assign settings, or races
- Added try-catch blocks around each save operation with specific handling for RLS errors
- RLS errors now log warnings to console instead of showing error alerts to users
- Settings are skipped if user doesn't have permission (expected behavior for new users without roles)

### 3. Verified Photo Paths

**Photo Paths Verified**:
- Default photos use paths: `assets/male_default.png`, `assets/female_default.png`, `assets/nonbinary_default.png`
- These paths are relative to the HTML file location
- Assets folder exists locally with all default photos
- Need to verify assets folder is committed to git

---

## Files Modified

1. **NEW**: `sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql`
   - SQL migration to add skills column

2. **MODIFIED**: `scripts/database.js`
   - Added `skills` field mapping to all rider and coach CRUD operations
   - Lines affected: getAllRiders, getRiderById, createRider, updateRider, getAllCoaches, getCoachById

3. **MODIFIED**: `teamridepro_v2.html`
   - Updated `saveRiderToDB()` to include skills
   - Updated `saveCoachToDB()` to include skills
   - Changed `adjustRiderPace()` to async and call `saveRiderToDB()` directly
   - Changed `adjustRiderSkills()` to async and call `saveRiderToDB()` directly
   - Changed `adjustCoachPace()` to call `saveCoachToDB()` directly (already async)
   - Changed `adjustCoachSkills()` to call `saveCoachToDB()` directly (already async)
   - Updated `saveData()` to check permissions and handle RLS errors gracefully

4. **NEW**: `docs/supabase/FIX_LIVE_SITE_ISSUES.md`
   - Comprehensive documentation of fixes and testing steps

---

## Action Items - REQUIRED

### 1. Run SQL Migration in Supabase
**PRIORITY: HIGH - Must be done before testing**

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste contents of `sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql`
3. Click "Run" to execute
4. Verify success - should see "Success. No rows returned"

```sql
-- Add skills column to riders and coaches tables
ALTER TABLE riders
ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT '3';

ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT '3';
```

### 2. Commit and Push Code Changes
**PRIORITY: HIGH**

```bash
# Navigate to project directory
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"

# Check status
git status

# Add all modified files
git add .

# Commit with descriptive message
git commit -m "Fix: Add skills column support, fix pace/skills persistence, handle RLS errors gracefully"

# Push to GitHub
git push origin main
```

### 3. Verify Assets Folder is Committed
**PRIORITY: MEDIUM**

```bash
# Check if assets folder is tracked
git ls-files assets/

# If not showing files, add them
git add assets/
git commit -m "Ensure assets folder and default photos are committed"
git push origin main
```

### 4. Test on Live Site
**PRIORITY: HIGH**

After pushing, wait 1-2 minutes for GitHub Pages to rebuild, then test:

- [ ] Change a rider's pace - verify it persists after logout/login
- [ ] Change a rider's skills - verify it persists after logout/login
- [ ] Change a coach's pace - verify it persists after logout/login
- [ ] Change a coach's skills - verify it persists after logout/login
- [ ] Log in as new user (without coach-admin role) - should NOT see RLS error
- [ ] Verify default photos display for riders/coaches without uploaded photos
- [ ] Assign coach-admin role to new user - verify they can save season settings

### 5. Assign Roles to New Users (If Needed)
**PRIORITY: MEDIUM**

If you have new users who need to save global settings:

1. In Supabase Dashboard → Authentication → Users, find the user
2. Copy their User ID
3. In SQL Editor, run:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'coach-admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'coach-admin';
```

---

## Testing Checklist

### Before Deployment
- [ ] SQL migration run successfully
- [ ] Code changes committed and pushed
- [ ] Assets folder verified in git
- [ ] No linter errors (already verified)

### After Deployment (Live Site)
- [ ] Pace changes persist after logout/login (riders)
- [ ] Skills changes persist after logout/login (riders)
- [ ] Pace changes persist after logout/login (coaches)
- [ ] Skills changes persist after logout/login (coaches)
- [ ] New user login doesn't show RLS error
- [ ] Default photos display correctly
- [ ] Users with coach-admin role can save season settings
- [ ] Users without coach-admin role can still use the app (just can't save global settings)

---

## Known Limitations

1. **New Users Without Roles**: New users can use the app but cannot save global season settings until they're assigned the `coach-admin` role. This is expected behavior and by design.

2. **Assets Paths**: If default photos still don't show after verifying assets are committed, check:
   - GitHub Pages URL structure (should be `username.github.io/repo-name/assets/...`)
   - File names are exactly correct (case-sensitive)
   - Wait 1-2 minutes after push for GitHub Pages to rebuild

---

## Related Documentation

- **Main Fix Guide**: `docs/supabase/FIX_LIVE_SITE_ISSUES.md`
- **GitHub Deployment**: `docs/supabase/GITHUB_DEPLOYMENT_GUIDE.md`
- **Database Schema**: `sql/database-schema.sql`
- **RLS Fixes**: `sql/FIX_SEASON_SETTINGS_RLS.sql`

---

## Technical Details

### Database Schema Changes
- Added `skills TEXT DEFAULT '3'` to `riders` table
- Added `skills TEXT DEFAULT '3'` to `coaches` table

### Function Flow Changes
**Before**:
```
adjustRiderPace() → update data.fitness → saveData() → (only saves season settings)
```

**After**:
```
adjustRiderPace() → update data.fitness → saveRiderToDB(rider) → updateRider() → Supabase
```

### Permission Check Flow
**Before**:
```
saveData() → updateSeasonSettings() → RLS error if no permission
```

**After**:
```
saveData() → hasRole('coach-admin')? → 
  Yes: updateSeasonSettings() with try-catch for RLS errors
  No: Skip with warning log
```

---

## Questions for Next Session

1. Did the SQL migration run successfully?
2. Are pace/skills changes now persisting after logout/login?
3. Are default photos displaying correctly?
4. Are there any remaining console errors?
5. Do new users need coach-admin roles assigned?

---

## Quick Reference Commands

```bash
# Check git status
git status

# Add all changes
git add .

# Commit
git commit -m "Fix: Add skills column support, fix pace/skills persistence, handle RLS errors gracefully"

# Push to GitHub
git push origin main

# Check if assets are tracked
git ls-files assets/

# View recent commits
git log --oneline -5
```

---

**Session Status**: ✅ All fixes completed and documented. Ready for SQL migration and deployment testing.

**Next Steps**: Run SQL migration → Commit/Push code → Test on live site → Assign roles as needed

