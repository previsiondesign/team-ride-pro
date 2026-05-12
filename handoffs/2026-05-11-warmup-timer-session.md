# Session Handoff — 2026-05-11 (Warmup Timer)

Entire session was on `utilities/warmup timer/` — separate from the morning's PDF/Strava/Slack work.

## What landed
- `utilities/warmup timer/warmup-timer.html` — Exchequer Race Warmup Timer. 30/25/20 buttons replace shorten/extend. 20 min uses 5/5 easy spins (was 6/4).
- `utilities/warmup timer/sixsigma-warmup.html` — Tam High MTB Warmup Timer. 35/30/25/20 options; **30 default**. 35 adds Build 80% (2m), 5th interval, 8m cooldown.
- `.github/workflows/sync-warmup-timer.yml` — auto-copies on push to `main` into `tamhighmtb/`:
  - `warmup-timer.html` → `tamhighmtb/exchequer-warmup.html`
  - `sixsigma-warmup.html` → `tamhighmtb/tammtb-warmup-timer.html`
  - `service-worker.js` and `manifest.json` also copied
- Workflow bot commits as `github-actions[bot]`; pulls before each user push are required.

## Live URLs
- `https://teamridepro.com/tamhighmtb/exchequer-warmup.html`
- `https://teamridepro.com/tamhighmtb/tammtb-warmup-timer.html`

## PWA login bug — root cause + fix (important)
**Symptom:** Visiting the link worked, but adding to home screen → tap → loaded the **main app's login screen**.
**Cause:** Shared `manifest.json` had `"start_url": "./"`. From `tamhighmtb/exchequer-warmup.html`, `./` resolves to `tamhighmtb/` → serves `index.html` (the auth-gated main app).
**Fix:** Each timer HTML now builds an inline manifest via `URL.createObjectURL(new Blob(...))` with `start_url: location.pathname`. The shared `manifest.json` is still synced but unused by the HTML — could be deleted later.

## Wrong turn (reverted)
Initially diagnosed the login bug as service-worker scope conflict and moved files to `tamhighmtb/timers/`. Wrong — SW only registers when the timer page is visited; new URL has no cached SW. Reverted; the real cause was the manifest start_url above.

## Naming history
Fort Ord → Exchequer. "Six Sigma" was the second timer's working name; renamed to "Tam High MTB Warmup Timer" with URL `tammtb-warmup-timer.html`. Old `tamhighmtb/sixsigma-warmup.html` was `git rm`'d.

## Working tree
Nothing relevant uncommitted. Stray `.tmp` files and untracked `.claude/`, `docs/cloudflare-zone.txt`, `sql/*`, `supabase/*.tmp` are pre-existing — not from this session.
