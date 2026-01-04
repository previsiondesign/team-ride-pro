# Setting Up Git and GitHub for This Project

This guide will help you set up version control and connect your project to GitHub.

## Step 1: Install Git

### Windows
1. Download Git from: https://git-scm.com/download/win
2. Run the installer with default settings
3. Restart your terminal/command prompt after installation

### Verify Installation
Open PowerShell or Command Prompt and run:
```bash
git --version
```
You should see a version number like `git version 2.x.x`

## Step 2: Configure Git (First Time Only)

Set your name and email (this will be used for all commits):

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Verify your configuration:
```bash
git config --global user.name
git config --global user.email
```

## Step 3: Initialize Git Repository

Navigate to your project folder and initialize Git:

```bash
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"
git init
```

## Step 4: Create Initial Commit

Add all files and create your first commit:

```bash
git add .
git commit -m "Initial commit: MTB Team Roster and Practice Manager"
```

## Step 5: Create GitHub Repository

1. Go to https://github.com and sign in (or create an account)
2. Click the "+" icon in the top right
3. Select "New repository"
4. Name it: `mtb-team-practice-manager` (or your preferred name)
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 6: Connect Local Repository to GitHub

GitHub will show you commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
git remote add origin https://github.com/YOUR_USERNAME/mtb-team-practice-manager.git
git branch -M main
git push -u origin main
```

You may be prompted for your GitHub username and password (or personal access token).

## Step 7: Set Up Regular Commits

### Recommended Workflow

After making changes to your project:

1. **Check what changed:**
   ```bash
   git status
   ```

2. **Stage your changes:**
   ```bash
   git add mtb-roster.html
   # Or to add all changed files:
   git add .
   ```

3. **Commit with a descriptive message:**
   ```bash
   git commit -m "feat: Add location map picker for practices"
   ```

4. **Push to GitHub:**
   ```bash
   git push
   ```

### Good Commit Message Format

Use prefixes to categorize changes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Formatting, styling
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Examples:
```
feat: Add description field to practices
fix: Correct mobile menu toggle behavior
docs: Update README with location setup instructions
style: Improve practice row field styling
```

## Step 8: Update CHANGELOG.md

After each significant change, update `CHANGELOG.md`:
1. Add entry under `[Unreleased]` section
2. Categorize as Added, Changed, Fixed, etc.
3. Include in your commit

## Troubleshooting

### If Git asks for credentials every time:
Set up credential helper:
```bash
git config --global credential.helper wincred
```

### If you get "fatal: not a git repository":
Make sure you're in the project directory and run `git init`

### If push is rejected:
You may need to pull first:
```bash
git pull origin main --rebase
git push
```

### To see commit history:
```bash
git log --oneline
```

## Quick Reference Commands

```bash
# Check status
git status

# See what changed
git diff

# Add all changes
git add .

# Commit
git commit -m "Your message here"

# Push to GitHub
git push

# Pull latest from GitHub
git pull

# View commit history
git log --oneline

# Create a new branch
git checkout -b feature/new-feature

# Switch back to main
git checkout main
```

## Next Steps

1. Make your first commit with the current state
2. Push to GitHub
3. Continue development, committing regularly
4. Update CHANGELOG.md as you make changes
5. Consider creating releases/tags for major versions




