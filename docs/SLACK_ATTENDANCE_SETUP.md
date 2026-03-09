# Slack Attendance Poll — Setup Checklist

Quick-start guide for deploying the Slack attendance poll system.
For detailed background, see `SLACK_ATTENDANCE_INTEGRATION.md`.

---

## Step 1: Create the Slack App

1. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**
2. **App Name:** `TeamRide Pro Attendance`
3. **Workspace:** Select your Tam High MTB workspace
4. Click **Create App**

### Add Slash Commands

1. Left sidebar → **Slash Commands** → **Create New Command**
2. Create two commands:

| Command | Short Description | Request URL |
|---------|-------------------|-------------|
| `/attend` | Mark yourself in for the next practice | *(fill in Step 4)* |
| `/post-poll` | Post attendance poll to channel | *(fill in Step 4)* |

### Add Bot Scopes

1. Left sidebar → **OAuth & Permissions**
2. Under **Bot Token Scopes**, add:
   - `users:read.email`
   - `chat:write`
   - `chat:write.public`

### Enable Interactivity

1. Left sidebar → **Interactivity & Shortcuts**
2. Toggle **Interactivity** → **On**
3. **Request URL:** *(fill in Step 4)*

### Install to Workspace

1. **OAuth & Permissions** → **Install to Workspace** → **Allow**
2. Copy the **Bot User OAuth Token** (`xoxb-...`)
3. Go to **Basic Information** → **App Credentials** → copy the **Signing Secret**

---

## Step 2: Run the SQL Migration

In Supabase Dashboard → **SQL Editor**, paste and run:

```sql
CREATE TABLE IF NOT EXISTS ride_rider_slack_notes (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id BIGINT REFERENCES riders(id) ON DELETE CASCADE,
  coach_id BIGINT REFERENCES coaches(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_person CHECK (rider_id IS NOT NULL OR coach_id IS NOT NULL),
  CONSTRAINT uq_ride_rider UNIQUE (ride_id, rider_id),
  CONSTRAINT uq_ride_coach UNIQUE (ride_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_ride ON ride_rider_slack_notes(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_rider ON ride_rider_slack_notes(rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_coach ON ride_rider_slack_notes(coach_id);
```

---

## Step 3: Add Secrets to Supabase

In Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**, add:

| Secret Name | Value | Where to Find It |
|-------------|-------|-------------------|
| `SLACK_SIGNING_SECRET` | Your app's Signing Secret | Slack → Basic Information → App Credentials |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-...`) | Slack → OAuth & Permissions |
| `SLACK_ATTENDANCE_CHANNEL_ID` | Channel ID for rider polls | Right-click channel in Slack → Copy link → extract the `C...` ID |
| `SLACK_COACH_CHANNEL_ID` | *(Optional)* Separate channel for coach polls | Same method |
| `CRON_SECRET` | *(Optional)* A random string for cron auth | Generate any random string (for automated polling later) |

### How to get a Channel ID

Right-click any Slack channel → "Copy link". The URL looks like:
`https://your-workspace.slack.com/archives/C0123456ABC`
The `C0123456ABC` part is the channel ID.

---

## Step 4: Deploy the Edge Function

```bash
cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\TeamRide Pro"
supabase functions deploy slack-attendance --no-verify-jwt
```

After deploy, copy the function URL:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/slack-attendance`

Then go back to Slack and paste this URL into:
- `/attend` slash command → **Request URL**
- `/post-poll` slash command → **Request URL**
- **Interactivity** → **Request URL**

All three use the **same URL**.

---

## Step 5: Test

### Test `/attend`

1. In any Slack channel, type `/attend`
2. You should see an ephemeral reply like:
   > "You're marked in for practice on Wednesday, Jan 29. See you there!"
3. Open TeamRide Pro → verify your attendance shows for that practice

### Test `/post-poll`

1. In Slack, type `/post-poll`
2. A poll message should appear in the configured channel with **Yes / No / Add Comment** buttons
3. Click **Yes** → verify ephemeral confirmation + attendance updates in TeamRide Pro
4. Click **No** → verify you're removed from attendance
5. Click **Add Comment** → modal opens → type a comment → submit

### Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid signature" / 401 | Double-check `SLACK_SIGNING_SECRET` in Supabase secrets |
| "Slack bot token not configured" | Add `SLACK_BOT_TOKEN` to Supabase secrets |
| "No email set" | User needs to add email to their Slack profile |
| "No rider or coach uses email..." | Email in Slack profile must match email in TeamRide Pro roster |
| "No upcoming practice found" | Ensure a ride exists with `date >= today` and `cancelled = false` |
| Poll doesn't post | Check `SLACK_ATTENDANCE_CHANNEL_ID` is set and bot is in the channel (invite with `/invite @TeamRide Pro Attendance`) |

### View Logs

Supabase Dashboard → **Edge Functions** → **slack-attendance** → **Logs**

---

## Step 6: Run the Poll Tracking Migration

In Supabase Dashboard → **SQL Editor**, paste and run the contents of `sql/ADD_SLACK_POLL_TRACKING.sql`. This creates two tables:

- **`slack_attendance_polls`** — tracks posted poll messages (channel + message timestamp) so the live tally can update them
- **`slack_poll_responses`** — tracks individual responses (who responded and whether attending) for tally counts + DM reminders

---

## Step 7: Add `im:write` Scope (for DM Reminders)

1. Go to **https://api.slack.com/apps** → select your app
2. Left sidebar → **OAuth & Permissions**
3. Under **Bot Token Scopes**, add: `im:write`
4. **Reinstall** the app to the workspace (you'll be prompted)

---

## Step 8: Set Up Auto-Posting (GitHub Actions)

### Add GitHub Repo Secrets

In your GitHub repo → **Settings** → **Secrets and variables** → **Actions**, add:

| Secret | Value |
|--------|-------|
| `SUPABASE_FUNCTION_URL` | `https://kweharxfvvjwrnswrooo.supabase.co/functions/v1/slack-attendance` |
| `CRON_SECRET` | Same value as the `CRON_SECRET` in Supabase secrets |

### How It Works

The workflow (`.github/workflows/attendance-poll.yml`) runs twice daily:

| Time (UTC) | Time (Pacific) | Action |
|------------|---------------|--------|
| 10 PM | ~3 PM | Posts poll **if** next practice is tomorrow |
| 3 PM | ~8 AM | Sends DM reminders to non-responders on practice day |

You can also trigger it manually from the **Actions** tab with a choice of:
- `post_poll_if_tomorrow` — only posts if practice is tomorrow
- `post_poll` — posts immediately for the next practice (regardless of date)
- `send_reminders` — sends DM reminders to non-responders

### Push the Workflow

Make sure `.github/workflows/attendance-poll.yml` is committed and pushed to the `main` branch for the scheduled triggers to activate.

---

## Features

### @channel Notification
When a poll is posted, all channel members are notified via `@channel`.

### Live Tally
After each response, the original poll message updates with:
> _8 attending · 2 not attending · 20 not yet responded_

### DM Reminders
Non-responders receive a personal DM on practice day morning with a **Confirm Attendance** button. This uses historical response data to map riders/coaches to Slack user IDs — so it only works for people who have responded to at least one previous poll.

---

## What's Next

- **Display comments in TeamRide Pro**: Load `ride_rider_slack_notes` and show on rider cards
- **SMS attendance**: See `docs/SMS_ATTENDANCE_PLAN.md`
