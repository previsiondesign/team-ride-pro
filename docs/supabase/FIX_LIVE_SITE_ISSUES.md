# Fix Live Site Issues

This document summarizes the fixes applied to resolve issues reported on the live GitHub Pages site.

## Issues Fixed

### 1. Rider/Coach Pace and Skills Settings Not Persisting

**Problem**: When changing rider/coach pace and skills settings, they appeared to save during the session but were lost after logout/login.

**Root Cause**: 
- The `skills` column was missing from the `riders` and `coaches` tables in the database
- The `adjustRiderPace()`, `adjustRiderSkills()`, `adjustCoachPace()`, and `adjustCoachSkills()` functions were calling `saveData()` which doesn't save individual riders/coaches - it only saves season settings, auto-assign settings, and races
- The database functions (`updateRider()`, `updateCoach()`, etc.) weren't handling the `skills` field

**Fixes Applied**:
1. Created SQL migration: `sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql` to add `skills` column to both tables
2. Updated `scripts/database.js` to include `skills` in all rider/coach CRUD operations:
   - `getAllRiders()` - now maps `skills` field
   - `getRiderById()` - now maps `skills` field
   - `createRider()` - now includes `skills` in insert
   - `updateRider()` - now includes `skills` in update
   - `getAllCoaches()` - now maps `skills` field
   - `getCoachById()` - now maps `skills` field
   - `createCoach()` - now includes `skills` in insert
   - `updateCoach()` - now includes `skills` in update
3. Updated `teamridepro_v2.html`:
   - `saveRiderToDB()` - now includes `skills` in the database mapping
   - `saveCoachToDB()` - now includes `skills` in the database mapping
   - `adjustRiderPace()` - now calls `saveRiderToDB(rider)` directly instead of `saveData()`
   - `adjustRiderSkills()` - now calls `saveRiderToDB(rider)` directly instead of `saveData()`
   - `adjustCoachPace()` - now calls `saveCoachToDB(coach)` directly instead of `saveData()`
   - `adjustCoachSkills()` - now calls `saveCoachToDB(coach)` directly instead of `saveData()`

**Action Required**: Run the SQL migration in Supabase SQL Editor:
```sql
-- Run: sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql
```

---

### 2. RLS Error for New Users

**Problem**: New users logging in received an error: "new row violates row-level security policy for table 'season_settings'"

**Root Cause**: When a new user logs in, they don't have the `coach-admin` role assigned, so they can't create/update `season_settings` due to RLS policies. The app was trying to save season settings without checking if the user had permission.

**Fixes Applied**:
1. Updated `saveData()` in `teamridepro_v2.html` to:
   - Check if user has `coach-admin` role using `hasRole('coach-admin')` before attempting to save season settings, auto-assign settings, or races
   - Gracefully handle RLS errors by catching them and logging a warning instead of showing an error to the user
   - Skip saving settings if user doesn't have permission (expected behavior for new users without roles)

**Action Required**: 
- New users need to be assigned the `coach-admin` role in Supabase to save global settings
- The app will now work without errors for users without roles, but they won't be able to save season settings until they're assigned the role

---

### 3. Default Photos Not Showing

**Problem**: Some rider/coach default photos do not show up on the live site.

**Root Cause**: The assets folder may not be committed to git, or the paths might be case-sensitive on GitHub Pages.

**Fixes Applied**:
- Verified that default photo paths are correct: `assets/male_default.png`, `assets/female_default.png`, `assets/nonbinary_default.png`
- These paths are relative to the HTML file location

**Action Required**: 
1. Verify that the `assets/` folder and all default photo files are committed to git:
   ```bash
   git add assets/
   git commit -m "Ensure assets folder is committed"
   git push
   ```
2. After pushing, verify the files are accessible on GitHub Pages:
   - `https://previsiondesign.github.io/team-ride-pro/assets/male_default.png`
   - `https://previsiondesign.github.io/team-ride-pro/assets/female_default.png`
   - `https://previsiondesign.github.io/team-ride-pro/assets/nonbinary_default.png`
3. If files are still not showing, check:
   - File names are exactly correct (case-sensitive)
   - Files are in the `assets/` folder at the repository root
   - GitHub Pages has rebuilt after the push (wait 1-2 minutes)

---

## Testing Checklist

After applying fixes:

- [ ] Run SQL migration: `sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql`
- [ ] Verify assets folder is committed and pushed to GitHub
- [ ] Test changing rider pace - should persist after logout/login
- [ ] Test changing rider skills - should persist after logout/login
- [ ] Test changing coach pace - should persist after logout/login
- [ ] Test changing coach skills - should persist after logout/login
- [ ] Test new user login - should not show RLS error
- [ ] Test default photos display correctly for riders/coaches without uploaded photos
- [ ] Assign `coach-admin` role to new user and verify they can save season settings

---

## Files Modified

1. `sql/ADD_SKILLS_COLUMN_TO_RIDERS_AND_COACHES.sql` - NEW FILE
2. `scripts/database.js` - Updated to handle `skills` field
3. `teamridepro_v2.html` - Updated save functions and adjust functions

---

## Next Steps

1. **Run the SQL migration** in Supabase SQL Editor
2. **Commit and push** the code changes to GitHub
3. **Verify assets folder** is committed and accessible
4. **Test** all fixes on the live site
5. **Assign roles** to new users as needed


