# Update Live Site Workflow

Quick reference guide for deploying changes to the live site.

---

## ⚠️ Which site are we updating? (March 2026)

| Site | Branch | Status | Action |
|------|--------|--------|--------|
| **v3 (active)** | `v3-dev` | **Current development** — all new work goes here | Edit in **TeamRide Pro v3** worktree (or checkout `v3-dev`), commit, **push `origin v3-dev`**. When v3 is promoted to production, merge `v3-dev` → `main` and point `index.html` to `teamridepro_v3.html`. |
| **v2 (frozen)** | `main` | No longer developed. Kept for legacy/reference. | Do **not** push feature fixes to `main`. Only critical hotfixes if v2 is still in use before v3 cutover. |

**To update the live v3 site:** Work in the **v3-dev** branch, then push `git push origin v3-dev`. If your live URL is already serving v3 (e.g. via `index.html` → `teamridepro_v3.html` after a merge to `main`), then promoting v3 to live = merge `v3-dev` into `main` and push.

---

## Live Site Information

- **Repository**: `previsiondesign/team-ride-pro`
- **v3 (active development)**: Develop on branch **`v3-dev`**. Entry: `teamridepro_v3.html`.
- **v2 (frozen)**: `main` branch. Entry: `teamridepro_v2.html`. URL: `https://previsiondesign.github.io/team-ride-pro/teamridepro_v2.html`
- **GitHub Pages**: Serves from the `main` branch (so “live” is whatever `index.html` points to)

---

## Standard Update Workflow (v3 — use this for normal development)

### Step 1: Make Your Changes

1. Work in the **v3 worktree** (`TeamRide Pro v3\`) or checkout `v3-dev` in the main folder.
2. Edit `teamridepro_v3.html` (or other files) locally.
3. Test locally:
   - Open `teamridepro_v3.html` in a browser
   - Test functionality in browser console
   - Check for any obvious errors

### Step 2: Check Git Status

```bash
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"
git status
```

This shows:
- Modified files (ready to commit)
- Untracked files (new files to add)
- Files that are staged for commit

### Step 3: Stage Your Changes

**Option A: Stage specific files (recommended)**
```bash
git add teamridepro_v2.html
# Or add multiple files:
git add teamridepro_v2.html styles.css scripts/database.js
```

**Option B: Stage all changes**
```bash
git add .
```
⚠️ **Warning**: This stages ALL modified files. Review `git status` first to make sure you want to commit everything.

### Step 4: Commit Your Changes

```bash
git commit -m "Description of what you changed"
```

**Good commit messages:**
- `"Fix: Rider pace not persisting after logout"`
- `"Add: New feature to filter rides by date"`
- `"Update: Improve error handling for RLS errors"`
- `"Fix: Default photos not displaying correctly"`

**Bad commit messages:**
- `"Update"`
- `"Changes"`
- `"Fix stuff"`

### Step 5: Push to GitHub

**For v3 (active development):**
```bash
git push origin v3-dev
```

**Only if you are deliberately updating v2 (frozen):**
```bash
git push origin main
```

Pushing to `v3-dev` updates the v3 branch. GitHub Pages rebuilds when `main` changes; to make v3 “live”, merge `v3-dev` into `main` and ensure `index.html` points to `teamridepro_v3.html`.

### Step 6: Wait for GitHub Pages to Rebuild

- **Wait time**: 1-2 minutes (usually less)
- **How to check**: 
  - Go to your repository on GitHub: `https://github.com/previsiondesign/team-ride-pro`
  - Click on the **Actions** tab (if enabled) to see deployment status
  - Or just wait 1-2 minutes and test the site

### Step 7: Test on Live Site

1. Visit: `https://previsiondesign.github.io/team-ride-pro/teamridepro_v3.html` (or v2 if still in use: `teamridepro_v2.html`)
2. **Hard refresh** to clear cache:
   - **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
   - **Mac**: `Cmd + Shift + R`
3. Test the changes you made
4. Check browser console for errors (F12 → Console tab)

---

## Quick Reference Commands

### Complete workflow in one go (v3):
```bash
# Navigate to project directory (v3 worktree or main folder with v3-dev checked out)
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\TeamRide Pro v3"
# Or: cd "D:\...\TeamRide Pro" then git checkout v3-dev

# Check what changed
git status

# Stage changes
git add teamridepro_v3.html scripts/app-groups.js styles.css

# Commit
git commit -m "Your descriptive commit message"

# Push v3 (active development)
git push origin v3-dev
```

### View recent commits:
```bash
git log --oneline -5
```

### Undo last commit (before pushing):
```bash
git reset --soft HEAD~1
```

### Discard local changes (careful!):
```bash
git restore teamridepro_v2.html
```

---

## Special Cases

### Database Changes (SQL Migrations)

If you've created or modified SQL files:

1. **Run SQL migration in Supabase first**:
   - Open Supabase Dashboard → SQL Editor
   - Copy/paste SQL from your migration file
   - Click "Run"
   - Verify success

2. **Then commit and push code changes** (as normal)

3. **Test on live site** to verify database changes work

### Multiple Files Changed

If you've changed multiple files:

```bash
# Stage specific files
git add teamridepro_v2.html scripts/database.js sql/NEW_MIGRATION.sql

# Or stage all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Multiple issues with rider persistence and RLS errors"

# Push
git push origin main
```

### Emergency Rollback

If you need to revert a change that's already live:

```bash
# Find the commit hash you want to revert to
git log --oneline -10

# Revert to a specific commit (creates new commit)
git revert <commit-hash>

# Or reset to a specific commit (destructive - be careful!)
git reset --hard <commit-hash>
git push origin main --force
```

⚠️ **Warning**: Force pushing rewrites history. Only use if you're sure!

---

## Troubleshooting

### Changes not showing on live site

1. **Hard refresh** the browser (Ctrl+Shift+R or Cmd+Shift+R)
2. **Wait longer** - GitHub Pages can take up to 2 minutes
3. **Check GitHub repository** - verify your push succeeded
4. **Check browser console** for errors
5. **Try incognito/private window** to bypass cache

### Git push fails

**Error: "Updates were rejected"**
- Someone else pushed changes
- Solution: Pull first, then push
```bash
git pull origin main
git push origin main
```

**Error: "Authentication failed"**
- Need to authenticate with GitHub
- Solution: Use GitHub CLI, SSH keys, or personal access token

### Files not being tracked

**File shows as "untracked"**
- Add it explicitly:
```bash
git add path/to/file
```

**File is ignored**
- Check `.gitignore` - file pattern might be excluded
- If intentional, that's fine
- If not, remove pattern from `.gitignore` or use `git add -f` to force add

---

## Best Practices

1. **Commit often** - Small, focused commits are easier to review and rollback
2. **Test locally first** - Catch errors before deploying
3. **Write descriptive commit messages** - Future you will thank you
4. **Review `git status`** before committing - Make sure you're committing what you intend
5. **Don't commit sensitive data** - API keys, passwords, etc. (use `.env` and `.gitignore`)
6. **Keep database migrations separate** - Run SQL first, then push code

---

## Checklist Before Pushing

- [ ] Changes tested locally (if possible)
- [ ] `git status` reviewed - only intended files staged
- [ ] Commit message is descriptive
- [ ] No sensitive data in files being committed
- [ ] Database migrations run (if applicable)
- [ ] Ready to test on live site after push

---

## Related Documentation

- **Full Deployment Guide**: `docs/supabase/GITHUB_DEPLOYMENT_GUIDE.md`
- **Database Migrations**: `sql/` folder
- **Troubleshooting**: `docs/troubleshooting/` folder

---

**Last Updated**: 2026-03-03 (v3 = active; v2 frozen)  
**Quick Command (v3)**: `git add . && git commit -m "Your message" && git push origin v3-dev`
