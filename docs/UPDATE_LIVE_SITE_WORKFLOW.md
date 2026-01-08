# Update Live Site Workflow

Quick reference guide for deploying changes to `teamridepro_v2.html` (and other files) to the live GitHub Pages site.

## Live Site Information

- **Repository**: `previsiondesign/team-ride-pro`
- **Live Site URL**: `https://previsiondesign.github.io/team-ride-pro/teamridepro_v2.html`
- **GitHub Pages**: Automatically deploys from `main` branch

---

## Standard Update Workflow

### Step 1: Make Your Changes

1. Edit `teamridepro_v2.html` (or other files) locally
2. Test changes locally if possible:
   - Open `teamridepro_v2.html` in a browser
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

```bash
git push origin main
```

This uploads your commits to GitHub. GitHub Pages will automatically detect the push and start rebuilding the site.

### Step 6: Wait for GitHub Pages to Rebuild

- **Wait time**: 1-2 minutes (usually less)
- **How to check**: 
  - Go to your repository on GitHub: `https://github.com/previsiondesign/team-ride-pro`
  - Click on the **Actions** tab (if enabled) to see deployment status
  - Or just wait 1-2 minutes and test the site

### Step 7: Test on Live Site

1. Visit: `https://previsiondesign.github.io/team-ride-pro/teamridepro_v2.html`
2. **Hard refresh** to clear cache:
   - **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
   - **Mac**: `Cmd + Shift + R`
3. Test the changes you made
4. Check browser console for errors (F12 → Console tab)

---

## Quick Reference Commands

### Complete workflow in one go:
```bash
# Navigate to project directory
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"

# Check what changed
git status

# Stage changes
git add teamridepro_v2.html

# Commit
git commit -m "Your descriptive commit message"

# Push to GitHub
git push origin main
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

**Last Updated**: 2024-12-27  
**Quick Command**: `git add . && git commit -m "Your message" && git push origin main`
