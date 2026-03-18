#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Sync with GitHub — pull latest changes from main
if git remote get-url origin &>/dev/null; then
  echo "Checking GitHub for updates..."
  git fetch origin main 2>/dev/null || true
  LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "")
  REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")
  if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    echo "Updates found — pulling latest from main..."
    git pull origin main --ff-only 2>/dev/null || echo "Auto-pull skipped (local changes detected). Run 'git pull' manually."
  else
    echo "Already up to date."
  fi
fi

# Install server dependencies (remote/web sessions only)
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  cd "$CLAUDE_PROJECT_DIR/server"
  npm install
fi
