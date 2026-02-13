# Slack Attendance Integration — Step-by-Step Guide

This guide walks you through adding a **Slack app** so team members can mark practice attendance from Slack (e.g. with a slash command like `/attend`). The app talks to **Team Practice Pro** by updating attendance in your Supabase database.

**Who this is for:** Developers with little or no experience with Slack APIs or Supabase Edge Functions. Follow the steps in order.

**Time estimate:** About 1–2 hours for the first-time setup.

---

## Table of Contents

1. [What You'll Need](#1-what-youll-need)
2. [Overview: How It Works](#2-overview-how-it-works)
3. [Part A: Create the Slack App](#part-a-create-the-slack-app)
4. [Part B: Add the Edge Function (Backend)](#part-b-add-the-edge-function-backend)
5. [Part C: Connect Slack to Your Backend](#part-c-connect-slack-to-your-backend)
6. [Part D: Install the App and Test](#part-d-install-the-app-and-test)
7. [Optional: Link Slack User ID to Riders](#optional-link-slack-user-id-to-riders)
8. [User-friendly poll (Yes / No / Comments)](#user-friendly-poll-yes--no--comments)
9. [Troubleshooting](#troubleshooting)

---

## 1. What You'll Need

Before starting, make sure you have:

- **Slack workspace** where your team already communicates (you need permission to install apps, usually an admin).
- **Supabase project** for Team Practice Pro (you already use this).
- **Supabase Dashboard** access (to create secrets and deploy the function).
- **Your computer** with a terminal (Command Prompt, PowerShell, or Mac/Linux terminal).
- **Optional:** Supabase CLI installed (we’ll show both Dashboard and CLI where they differ).

---

## 2. Overview: How It Works

**Basic flow (slash command):**

1. A rider or coach types **`/attend`** (or similar) in Slack.
2. Slack sends an HTTPS request to **your** backend (a Supabase Edge Function).
3. The Edge Function:
   - Verifies the request really came from Slack (using a shared secret).
   - Figures out **who** in Slack sent the command (using their Slack profile email).
   - Finds that person in your **riders** or **coaches** table (by matching email).
   - Finds the **next upcoming practice** (next ride by date).
   - Adds that person’s ID to that practice’s **attendance list** (`available_riders` or `available_coaches`).
   - Saves the updated ride back to Supabase.
4. Team Practice Pro (the website) already reads attendance from the same database, so the next time someone opens the app or refreshes, they’ll see the updated attendance.

No changes are required to the main Team Practice Pro HTML/JS; only a new Edge Function and Slack app configuration.

**Alternative: user-friendly poll** — Instead of (or in addition to) typing `/attend`, you can post a **poll message** in a channel with buttons: **Yes**, **No**, and **Add comment**. People click once to respond. The poll can be **automated** (e.g. posted each week for the next practice). Comments can be saved and shown on that rider’s card for that practice in Team Practice Pro. See [User-friendly poll (Yes / No / Comments)](#user-friendly-poll-yes--no--comments) for options and step-by-step instructions.

---

## Part A: Create the Slack App

### Step A.1: Open the Slack API site

1. Go to **https://api.slack.com/apps** in your browser.
2. Log in with the Slack workspace where your team lives.
3. Click **“Create New App”**.

### Step A.2: Create the app from scratch

1. Choose **“From scratch”**.
2. **App Name:** e.g. `Team Practice Pro` or `MTB Attendance`.
3. **Pick a workspace:** Select your team’s workspace.
4. Click **“Create App”**.

### Step A.3: Add a Slash Command

1. In the left sidebar, click **“Slash Commands”**.
2. Click **“Create New Command”**.
3. Fill in:
   - **Command:** `/attend` (users will type this).
   - **Short Description:** e.g. `Mark yourself in for the next practice`.
   - **Usage Hint (optional):** e.g. `(no arguments needed)`.
4. Leave **“Request URL”** empty for now. You’ll paste your Edge Function URL here in [Part C](#part-c-connect-slack-to-your-backend).
5. Click **“Save”**.

### Step A.4: Add Bot Scopes (so we can look up the user’s email)

1. In the left sidebar, click **“OAuth & Permissions”**.
2. Under **“Scopes”**, find **“Bot Token Scopes”**.
3. Click **“Add an OAuth Scope”** and add:
   - **`users:read.email`** — so we can get the Slack user’s email and match them to a rider/coach.
4. Save if prompted.

### Step A.5: Install the app to your workspace

1. Still under **“OAuth & Permissions”**.
2. At the top, click **“Install to Workspace”**.
3. Review the permissions and click **“Allow”**.
4. You’ll see a **“Bot User OAuth Token”** (starts with `xoxb-`). **Copy it** and keep it safe (e.g. in a password manager or a temporary note). You’ll add it to Supabase secrets in Part B.
5. Also copy the **“Signing Secret”** (under **“App Credentials”** in the left sidebar, or **Settings → Basic Information → App Credentials**). You’ll add this to Supabase as well.

You’re done with the Slack side until Part C. Next: build the backend that Slack will call.

---

## Part B: Add the Edge Function (Backend)

The backend is a **Supabase Edge Function** that:

- Receives the Slack slash command.
- Verifies the request using Slack’s signing secret.
- Looks up the user’s email in Slack, then finds the matching rider or coach in your DB.
- Finds the next practice (ride) and adds the person to that ride’s attendance.
- Writes the updated ride back to Supabase (using the service role so it’s allowed to update any ride).

### Step B.1: Create the function folder and file

1. On your computer, open the **Team Practice Pro** project folder (the one that contains `teamridepro_v2.html` and the `supabase` folder).
2. Go to `supabase/functions/`. If there is no `functions` folder, create it.
3. Create a new folder named **`slack-attendance`** (no spaces).
4. Inside `slack-attendance`, create a file named **`index.ts`**.

So you should have:  
`supabase/functions/slack-attendance/index.ts`

### Step B.2: Paste the Edge Function code

Open `supabase/functions/slack-attendance/index.ts` in a text editor and paste the code below. **Do not change the code yet**; get it working first. You’ll add your secrets in the next step.

```typescript
// supabase/functions/slack-attendance/index.ts
// Handles Slack slash command /attend and marks the user for the next practice.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET");
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function verifySlackRequest(body: string, signature: string | null, timestamp: string | null): boolean {
  if (!SLACK_SIGNING_SECRET || !signature || !body || !timestamp) return false;
  const [version, hash] = signature.split("=");
  if (version !== "v0" || !hash) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBase = `v0:${timestamp}:${body}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sigBase)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash === hex;
}

// Parse application/x-www-form-urlencoded body (how Slack sends slash commands)
function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [key, value] = pair.split("=").map((s) => decodeURIComponent(s.replace(/\+/g, " ")));
    if (key && value !== undefined) params[key] = value;
  }
  return params;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Slack-Signature");
  const timestamp = req.headers.get("X-Slack-Request-Timestamp");

  // Replay protection: reject if request is too old (e.g. > 5 minutes)
  if (timestamp) {
    const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (age > 300) {
      return new Response("Request too old", { status: 400 });
    }
  }

  if (!verifySlackRequest(rawBody, signature, timestamp)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const form = parseFormBody(rawBody);
  const slackUserId = form.user_id;
  const command = form.command;
  const responseUrl = form.response_url; // optional: for delayed response

  if (!slackUserId) {
    return new Response(JSON.stringify({ text: "Could not identify Slack user." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get Slack user's email via Slack API
  if (!SLACK_BOT_TOKEN) {
    return new Response(JSON.stringify({ text: "Slack bot token not configured. Ask an admin to set SLACK_BOT_TOKEN." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let email: string | null = null;
  try {
    const userRes = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const userData = await userRes.json();
    if (userData.ok && userData.user?.profile?.email) {
      email = userData.user.profile.email.trim().toLowerCase();
    }
  } catch (e) {
    console.error("Slack users.info error:", e);
  }

  if (!email) {
    return new Response(JSON.stringify({
      response_type: "ephemeral",
      text: "Your Slack profile doesn’t have an email set, or the app can’t read it. Add an email in Slack or ask an admin to link your account.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find rider or coach by email
  const { data: riders } = await supabase.from("riders").select("id").ilike("email", email);
  const { data: coaches } = await supabase.from("coaches").select("id").ilike("email", email);
  const riderId = riders?.[0]?.id;
  const coachId = coaches?.[0]?.id;

  if (!riderId && !coachId) {
    return new Response(JSON.stringify({
      response_type: "ephemeral",
      text: `No rider or coach in Team Practice Pro uses the email ${email}. Add this email to your profile in the app or ask an admin to add you.`,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // Next upcoming practice: not deleted, not cancelled, date >= today
  const today = new Date().toISOString().slice(0, 10);
  const { data: rides, error: rideError } = await supabase
    .from("rides")
    .select("id, date, available_riders, available_coaches")
    .eq("deleted", false)
    .eq("cancelled", false)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);

  if (rideError || !rides?.length) {
    return new Response(JSON.stringify({
      response_type: "ephemeral",
      text: "No upcoming practice found, or there was an error loading rides.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const ride = rides[0];
  const availableRiders: number[] = Array.isArray(ride.available_riders) ? ride.available_riders : [];
  const availableCoaches: number[] = Array.isArray(ride.available_coaches) ? ride.available_coaches : [];

  let updated = false;
  if (riderId && !availableRiders.includes(riderId)) {
    availableRiders.push(riderId);
    updated = true;
  }
  if (coachId && !availableCoaches.includes(coachId)) {
    availableCoaches.push(coachId);
    updated = true;
  }

  if (updated) {
    await supabase
      .from("rides")
      .update({ available_riders: availableRiders, available_coaches: availableCoaches })
      .eq("id", ride.id);
  }

  const rideDate = ride.date;
  const message = updated
    ? `You’re marked in for the next practice (${rideDate}). See you there!`
    : `You were already marked in for the next practice (${rideDate}).`;

  return new Response(JSON.stringify({
    response_type: "ephemeral",
    text: message,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
```

**Note:** Slack sends slash commands as `application/x-www-form-urlencoded`. The function verifies the request using the **Signing Secret** and the `v0:timestamp:body` string per [Slack’s docs](https://api.slack.com/authentication/verifying-requests-from-slack). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions; you only add `SLACK_SIGNING_SECRET` and `SLACK_BOT_TOKEN`.

### Step B.3: Set secrets in Supabase

The function needs two secrets that **only you** (or your team admin) should know. Never put these in the code or in git.

1. Open **Supabase Dashboard** → your project → **Project Settings** (gear icon) → **Edge Functions**.
2. Find **Secrets** (or **Function Secrets**).
3. Add two secrets:

   | Name | Value | Where you got it |
   |------|--------|-------------------|
   | `SLACK_SIGNING_SECRET` | Your app’s **Signing Secret** | Slack: **Settings → Basic Information → App Credentials** |
   | `SLACK_BOT_TOKEN` | Your app’s **Bot User OAuth Token** (starts with `xoxb-`) | Slack: **OAuth & Permissions** after “Install to Workspace” |

4. Save. Supabase will inject these into the Edge Function at runtime (you don’t need to change the code).

### Step B.4: Deploy the Edge Function

You need the **Supabase CLI** and to be logged in.

1. **Install Supabase CLI** (if you don’t have it):
   ```bash
   npm install -g supabase
   ```
2. **Log in and link the project** (from your project folder):
   ```bash
   cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro"
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Replace `YOUR_PROJECT_REF` with your project ref (find it in Supabase Dashboard → Project Settings → General → Reference ID).

3. **Deploy the function**:
   ```bash
   supabase functions deploy slack-attendance --no-verify-jwt
   ```
   `--no-verify-jwt` is used because Slack sends the request without a Supabase JWT; we verify the request with the Slack signing secret instead.

4. After deploy, Supabase will show the function URL, e.g.:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/slack-attendance`
   **Copy this URL** — you’ll paste it into Slack in Part C.

If you prefer not to use the CLI, you can create and paste the same code in **Supabase Dashboard → Edge Functions → Create function** (name: `slack-attendance`), then deploy from there. The URL will be the same format.

---

## Part C: Connect Slack to Your Backend

1. Go back to **https://api.slack.com/apps** and select your app.
2. Click **Slash Commands** in the left sidebar.
3. Click your **/attend** command to edit it.
4. In **Request URL**, paste your Edge Function URL, e.g.:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/slack-attendance`
5. Click **Save**.

Slack will send a POST request to this URL every time someone runs `/attend`. The URL must be **HTTPS** and **public** (no login required); the function stays secure because it verifies the Slack signature and only updates attendance for the identified user.

---

## Part D: Install the App and Test

### Step D.1: Install the app to the workspace (if not already)

1. In Slack API: **OAuth & Permissions** → **Install to Workspace** (or **Reinstall** if you already installed).
2. Complete the approval so the app is in your workspace.

### Step D.2: Test the slash command

1. In Slack, open any channel or a DM.
2. Type: **`/attend`** and press Enter.
3. You should see a reply **only to you** (ephemeral message), for example:
   - “You’re marked in for the next practice (2026-01-25). See you there!”
   - Or an error like “Your Slack profile doesn’t have an email set…” or “No rider or coach uses the email …”.

### Step D.3: Check Team Practice Pro

1. Open **Team Practice Pro** in the browser (the same Supabase project).
2. Go to the practice that matches the date shown in Slack (e.g. **Rider Assignments** or **Practice Planner** and select that date).
3. Confirm that you (or the test user) appear in the attendance list for that practice.

If something doesn’t work, see [Troubleshooting](#troubleshooting) below.

---

## Optional: Link Slack User ID to Riders

Right now the function matches people by **email**: it reads the Slack user’s profile email and finds a rider or coach with that email in your database. That’s the simplest approach and requires no schema change.

If you want a more reliable link (e.g. some users don’t have email in Slack, or you want to support one Slack user as both rider and coach by choice), you can:

1. Add a column to your `riders` and/or `coaches` tables, e.g. `slack_user_id` (text).
2. Build a small “Link my Slack” flow (e.g. in Team Practice Pro or via a second Slack command) that:
   - Lets the user authenticate or confirm who they are,
   - Then saves their Slack user ID (`user_id` from Slack) into `riders.slack_user_id` or `coaches.slack_user_id`.
3. In the Edge Function, **first** try to find a rider/coach by `slack_user_id`; if none, fall back to email as it does now.

This is optional; the email-based flow is enough for many teams.

---

## User-friendly poll (Yes / No / Comments)

Relying only on **`/attend`** can feel clunky. A **poll in Slack** is more user-friendly: one message (e.g. “Practice Saturday Jan 25 – Are you in?”) with buttons **Yes**, **No**, and **Add comment**. People click once to respond. This section describes your options, how to build it, and how to automate it. It also covers saving **comments** and showing them on the rider’s card for that practice in Team Practice Pro.

### Poll options in Slack

| Option | What it is | Use for attendance? | Automated? |
|--------|------------|---------------------|------------|
| **Slash command** (`/attend`) | User types a command. | ✅ Already in this guide. | No (user-initiated). |
| **Block Kit message with buttons** | You (or your app) post a message with buttons; users click. | ✅ **Recommended.** One click instead of typing. | ✅ Yes: a scheduled job can post the message. |
| **Slack’s built-in Poll app** | Native `/poll` in some workspaces. | ❌ Results stay in Slack; no easy way to push to Team Practice Pro. | Limited. |
| **Modal for “Add comment”** | Clicking “Add comment” opens a popup; user types and submits. | ✅ Use **with** the button message. Comments can be sent to your backend and stored. | N/A (triggered by button). |

**Recommended:** Use a **Block Kit message** with three buttons: **Yes**, **No**, **Add comment**. The same Edge Function that handles `/attend` can handle **button clicks** (Slack sends a different payload type). You can post that message **manually** at first, or **automate** it (e.g. a scheduled Edge Function that runs weekly and posts to a channel).

### How the poll works end-to-end

1. **Message is posted** in a channel (by you or by an automated job). The message includes:
   - Text like: “Practice **Saturday Jan 25** – Are you in?”
   - **Blocks** with three buttons, each with a **value** that includes the **ride ID** (e.g. `yes_42` or `no_42` so you know which practice and which choice).
2. **User clicks Yes** → Slack sends an **interaction payload** (type `block_actions`) to your **Interactivity Request URL** (same Edge Function URL). Your function:
   - Verifies the request (same signing secret).
   - Reads `user.id`, resolves to rider/coach by email (or `slack_user_id`), gets `ride_id` from the button value.
   - Adds that person to `available_riders` / `available_coaches` for that ride (same logic as `/attend`).
   - Optionally **updates the message** (e.g. “✅ You’re in”) or replies ephemerally.
3. **User clicks No** → Same flow, but your function **removes** that person from `available_riders` / `available_coaches` for that ride.
4. **User clicks Add comment** → Your function opens a **Slack modal** (popup) with a text input. User types and submits. Slack sends a **view_submission** payload to the same Request URL. Your function:
   - Saves the comment to your database (e.g. a new table `ride_rider_slack_notes`: `ride_id`, `rider_id`, `note`, `created_at`).
   - Responds to Slack to close the modal.
5. **Showing comments in Team Practice Pro:** The app currently shows **rider.notes** (global notes) on the rider card. To show **“note for this practice”**, you add a small change: load per-ride notes (e.g. from `ride_rider_slack_notes`) for the current ride and display them on that rider’s card in the assignments view. **Feasible;** see below.

### What’s feasible vs. harder

| Feature | Feasibility | Notes |
|---------|-------------|--------|
| **Poll with Yes / No buttons** | ✅ Straightforward | Reuse same Edge Function; add handling for `block_actions` and button `value` (e.g. `yes_<ride_id>`, `no_<ride_id>`). |
| **Automated poll (post message on a schedule)** | ✅ Straightforward | Add a **scheduled** Edge Function (or cron that calls it) that: finds the next practice, calls Slack `chat.postMessage` with the Block Kit message, targets a channel (channel ID in env). Requires **chat:write** (and optionally **chat:write.public**) scope. |
| **Add comment button + modal** | ✅ Straightforward | Slack supports modals; your function opens a modal when “Add comment” is clicked, then handles `view_submission` with the typed text. |
| **Saving comments to DB** | ✅ Straightforward | New table (e.g. `ride_rider_slack_notes`) or a JSON field on `rides`. Edge Function uses Supabase service role to insert. No RLS change needed if only the function writes. |
| **Showing comments on rider card for that practice** | ✅ Feasible, needs app change | Team Practice Pro would need to: (1) load per-ride notes for the current ride (new API or table read), (2) render them on the rider card in the assignments view (e.g. under or next to existing notes). Small, localized change in `teamridepro_v2.html` and possibly `database.js`. |

Nothing here is infeasible; the only “extra” work is the optional **display** of per-practice comments in the web app.

### Step-by-step: Add the poll and comments

#### 1. Enable Interactivity and set Request URL

1. In [Slack API](https://api.slack.com/apps) → your app → **Interactivity & Shortcuts**.
2. Turn **Interactivity** **On**.
3. **Request URL:** use the **same** URL as your slash command, e.g.  
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/slack-attendance`  
   Slack will send both slash-command and button-click (and modal) payloads here.
4. Save.

#### 2. Add scope so the app can post messages (for automation)

1. **OAuth & Permissions** → **Bot Token Scopes** → **Add an OAuth Scope**.
2. Add **`chat:write`** (so the bot can post the poll in a channel). If the poll should be posted in public channels without joining them first, add **`chat:write.public`**.
3. Reinstall the app to the workspace (Slack will prompt).

#### 3. Update the Edge Function to handle button clicks and modals

Your function currently handles only **slash commands** (POST body is `application/x-www-form-urlencoded` with `command`, `user_id`, etc.). Slack sends **interactions** as the same content type, but with a single field **`payload`** (a JSON string) containing:

- **`type: "block_actions"`** when a button is clicked: `user.id`, `actions[].action_id`, `actions[].value` (your ride_id or `yes_42` / `no_42`), `response_url`.
- **`type: "view_submission"`** when a modal is submitted: `user.id`, `view.callback_id`, `view.state.values` (the input block’s value = comment text). You can pass `ride_id` in `callback_id` (e.g. `comment_42`).

**Logic to add (in the same `slack-attendance` function):**

1. **Parse the POST body.** If it has a key **`payload`**, parse `payload` as JSON.
2. **If `payload.type === "block_actions"`:**
   - Read `payload.user.id`, `payload.actions[0].value` (e.g. `yes_42` or `no_42`). Split to get action (yes/no) and ride_id.
   - Resolve user to rider/coach (same as today: email or slack_user_id).
   - If **yes:** add to `available_riders` / `available_coaches` for that ride. If **no:** remove from those arrays.
   - Respond with 200 and optionally a JSON body that **updates the message** or sends an ephemeral reply (Slack docs: “Responding to interactions”).
3. **If `payload.type === "view_submission"`** (modal submit):
   - Read `payload.user.id`, `payload.view.callback_id` (e.g. `comment_42`), and the comment text from `payload.view.state.values`.
   - Resolve user to rider; insert into `ride_rider_slack_notes(ride_id, rider_id, note, created_at)`.
   - Respond with 200 and `{ "response_action": "clear" }` to close the modal (or `response_action: "errors"` if validation fails).
4. **If the request has no `payload`** (or has `command`), keep your existing slash-command handling.

You still **verify the request** with the same signing secret and timestamp (for the **raw body** of the POST, before parsing).

#### 4. Opening the “Add comment” modal when the user clicks the button

When the user clicks **Add comment**, your function must respond **within 3 seconds** with a **modal definition** (Slack opens it). So:

- On **block_actions** with `value === "comment_<ride_id>"`, do **not** do the DB update yet. Instead, return 200 with a JSON body that tells Slack to **open a modal**:  
  `{ "response_action": "push", "view": { ... } }`  
  The modal view includes an input block (e.g. `plain_text_input` with `multiline: true`) and `submit` / `cancel`. The view’s `callback_id` can be `comment_<ride_id>` so on **view_submission** you know which ride and can save the comment.

Slack’s docs: [Modals](https://api.slack.com/surfaces/modals/using), [Responding to block_actions](https://api.slack.com/interactivity/handling#message_responses).

#### 5. Database table for comments (per-ride, per-rider)

Run this in Supabase **SQL Editor** (once):

```sql
-- Comments from Slack poll "Add comment" – per ride, per rider
CREATE TABLE IF NOT EXISTS ride_rider_slack_notes (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id BIGINT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ride_id, rider_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_ride ON ride_rider_slack_notes(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_rider_slack_notes_rider ON ride_rider_slack_notes(rider_id);
```

The Edge Function (using the **service role** key) can **insert** and **upsert** (ON CONFLICT ride_id, rider_id DO UPDATE SET note = ..., updated_at = NOW()) so each rider has at most one Slack note per practice. RLS can be left off for this table if only the Edge Function writes; or add a policy that allows the service role / backend to manage rows.

#### 6. Posting the poll message (manual or automated)

**Manual (to try it first):** In Slack, use **Workflow Builder** or a simple script that calls `chat.postMessage` with the blocks. Or, add a **second** slash command (e.g. `/post-attendance-poll`) that only coaches/admins can use: when called, the function finds the next practice, builds the Block Kit message with Yes / No / Add comment (values like `yes_<ride_id>`, `no_<ride_id>`, `comment_<ride_id>`), and posts it to a channel (channel ID from env, e.g. `SLACK_ATTENDANCE_CHANNEL_ID`).

**Automated:** Use a **scheduled** job that runs (e.g. every Monday 9am):

- **Option A:** Supabase **pg_cron** (if available) plus a small Edge Function that the cron invokes (e.g. via `http_request` or a Supabase “scheduled function” if your plan supports it).
- **Option B:** An external cron (e.g. cron.org, GitHub Actions scheduled workflow) that calls an Edge Function URL (e.g. `POST /functions/v1/slack-attendance` with a secret header like `X-Cron-Secret` and a body like `{ "action": "post_poll" }`). The function then finds the next ride, calls Slack `chat.postMessage`, and returns.

In both cases, the function needs the **Bot User OAuth Token** (already in secrets) and **chat:write** (and optionally **chat:write.public**). Store the target **channel ID** (e.g. `C01234ABCD`) in a secret like `SLACK_ATTENDANCE_CHANNEL_ID`.

#### 7. Showing comments on the rider’s card in Team Practice Pro

Today the app shows **rider.notes** (global) on the rider card. To show **“Slack note for this practice”**:

1. **Backend:** Expose per-ride notes to the app. Options:
   - Add a function in `database.js` like `getRideRiderSlackNotes(rideId)` that reads from `ride_rider_slack_notes` (and respects RLS if you add policies). Or include these notes in the ride payload when the app loads ride details.
2. **Front-end:** In `teamridepro_v2.html`, where the rider card is rendered for the assignments view (e.g. in `renderGroupCard` or the rider list for that ride), after loading the ride’s slack notes (keyed by rider_id), render a small line like “Slack: [comment text]” or an icon that shows the note in a tooltip. Reuse the same pattern as the existing notes icon if you like.

This is a small, contained change; the only “difficult” part is deciding where on the card to show the note so it doesn’t clutter the UI.

### Summary: poll + comments

- **Poll (Yes / No / Add comment)** is **user-friendly** and **feasible**: same Edge Function, add handling for `block_actions` and `view_submission`, and optionally a way to post the message (manual or scheduled).
- **Comments** can be stored in **`ride_rider_slack_notes`** and shown on the rider’s card for that practice with a **small app change** (load + display per-ride notes).
- **Automation** of the poll is **feasible** with a scheduled job (Supabase or external) that calls your function to post the Block Kit message to a channel.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| “Invalid signature” or 401 | Signing secret must match exactly. In Supabase, ensure the secret is named `SLACK_SIGNING_SECRET` and the value is the one from Slack **App Credentials**. No extra spaces. |
| “Slack bot token not configured” | Add `SLACK_BOT_TOKEN` in Supabase Edge Function secrets. Use the **Bot User OAuth Token** from **OAuth & Permissions** (starts with `xoxb-`). |
| “Your Slack profile doesn’t have an email set” | In Slack: **Profile → Edit profile** and add an email. The app needs the **users:read.email** scope and the workspace may need to allow profile visibility. |
| “No rider or coach uses the email …” | In Team Practice Pro, ensure the rider or coach has an **email** saved and that it matches the Slack profile email (case doesn’t matter; the function compares lowercased). |
| “No upcoming practice found” | In Supabase, check the `rides` table: there should be at least one row with `date >= today`, `deleted = false`, and `cancelled = false`. |
| Slash command shows “failed to run” in Slack | Slack must get an HTTP 200 within a few seconds. Check Supabase **Edge Functions → slack-attendance → Logs** for errors. Fix the function or secrets and redeploy. |
| Attendance doesn’t appear in the app | Refresh the page or re-open the practice; the app reads `available_riders` / `available_coaches` from the same database the function updates. |

### Viewing Edge Function logs

1. Supabase Dashboard → **Edge Functions** → **slack-attendance**.
2. Open **Logs** or **Invocations** to see each request and any `console.error` output. Use this to debug missing email, DB errors, or wrong ride selection.

---

## Summary Checklist

- [ ] Slack app created; slash command **/attend** added; **users:read.email** scope added; app installed to workspace.
- [ ] Signing Secret and Bot User OAuth Token copied from Slack.
- [ ] Edge Function **slack-attendance** created in `supabase/functions/slack-attendance/index.ts` with the code above.
- [ ] Secrets **SLACK_SIGNING_SECRET** and **SLACK_BOT_TOKEN** set in Supabase.
- [ ] Function deployed (`supabase functions deploy slack-attendance --no-verify-jwt`).
- [ ] Slack slash command **Request URL** set to the function URL.
- [ ] Test: run `/attend` in Slack; confirm ephemeral reply and attendance in Team Practice Pro for the next practice.

Once this works, you can add more commands (e.g. “I’m out” to remove from attendance) or message actions by adding more endpoints or branches in the same function.

---

## Related documentation

- **Edge Functions (existing):** `docs/EDGE_FUNCTION_SEND_VERIFICATION_CODE.md`, `docs/VERIFICATION_SETUP_STEPS.md`
- **Deploying Edge Functions:** `docs/DEPLOY_ADMIN_INVITATION_FUNCTION.md`
- **Slack API (slash commands):** https://api.slack.com/interactivity/slash-commands  
- **Slack (verifying requests):** https://api.slack.com/authentication/verifying-requests-from-slack
- **Slack Block Kit:** https://api.slack.com/block-kit
- **Slack Modals:** https://api.slack.com/surfaces/modals/using
- **Slack Interactivity (buttons, modals):** https://api.slack.com/interactivity/handling
</think>
Fixing Slack signature verification: Slack uses `v0:${timestamp}:${body}` for the signed base string.
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read