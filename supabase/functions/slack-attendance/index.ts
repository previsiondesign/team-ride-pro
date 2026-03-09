// supabase/functions/slack-attendance/index.ts
// Slack attendance poll with 3-step flow:
//   1. Channel message with @channel: "Confirm your attendance for [DATE] at [TIME]" + [Confirm Attendance]
//   2. Modal: "I will attend" / "I will not attend" + mandatory reason if absent
//   3. Ephemeral confirmation with [Update Response] button
//
// Live tally: original poll message updates with "X attending · Y not attending · Z not yet responded"
//
// Also handles:
//   - /attend slash command (quick mark-attending)
//   - /post-poll slash command (post poll to channel)
//   - Cron actions via X-Cron-Secret header:
//       post_poll            — post poll for next practice immediately
//       post_poll_if_tomorrow — only post if next practice is tomorrow (for daily cron)
//       send_reminders       — DM non-responders with a reminder + Confirm button

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Environment ---
const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") ?? "";
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_ATTENDANCE_CHANNEL_ID = Deno.env.get("SLACK_ATTENDANCE_CHANNEL_ID") ?? "";
const SLACK_COACH_CHANNEL_ID = Deno.env.get("SLACK_COACH_CHANNEL_ID") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// =============================================================================
// HELPERS — Slack verification & parsing
// =============================================================================

async function verifySlackRequest(
  body: string,
  signature: string | null,
  timestamp: string | null
): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET || !signature || !body || !timestamp) return false;
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) return false;
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
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`v0:${timestamp}:${body}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash === hex;
}

function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [key, value] = pair.split("=").map((s) => decodeURIComponent(s.replace(/\+/g, " ")));
    if (key && value !== undefined) params[key] = value;
  }
  return params;
}

function ephemeral(text: string): Response {
  return new Response(
    JSON.stringify({ response_type: "ephemeral", text }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// =============================================================================
// HELPERS — Slack profile & person matching
// =============================================================================

interface SlackProfile {
  email: string | null;
  realName: string | null;
  displayName: string | null;
  phone: string | null;
}

async function getSlackProfile(slackUserId: string): Promise<SlackProfile | null> {
  if (!SLACK_BOT_TOKEN) return null;
  try {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );
    const data = await res.json();
    if (data.ok && data.user) {
      const profile = data.user.profile ?? {};
      return {
        email: profile.email?.trim().toLowerCase() ?? null,
        realName: (data.user.real_name || profile.real_name || "").trim() || null,
        displayName: (profile.display_name || "").trim() || null,
        phone: profile.phone?.trim() || null,
      };
    }
  } catch (e) {
    console.error("Slack users.info error:", e);
  }
  return null;
}

function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

interface PersonMatch {
  riderId: number | null;
  coachId: number | null;
  matchedBy: "email" | "phone" | "name" | null;
}

async function findPerson(
  supabase: ReturnType<typeof createClient>,
  profile: SlackProfile
): Promise<PersonMatch> {
  // Strategy 1: Email
  if (profile.email) {
    const [{ data: riders }, { data: coaches }] = await Promise.all([
      supabase.from("riders").select("id").ilike("email", profile.email),
      supabase.from("coaches").select("id").ilike("email", profile.email),
    ]);
    const riderId = riders?.[0]?.id ?? null;
    const coachId = coaches?.[0]?.id ?? null;
    if (riderId || coachId) {
      console.log(`Matched by email: ${profile.email}`);
      return { riderId, coachId, matchedBy: "email" };
    }
  }

  // Strategy 2: Phone
  if (profile.phone) {
    const slackDigits = phoneDigits(profile.phone);
    if (slackDigits.length >= 7) {
      const [{ data: riders }, { data: coaches }] = await Promise.all([
        supabase.from("riders").select("id, phone").not("phone", "is", null),
        supabase.from("coaches").select("id, phone").not("phone", "is", null),
      ]);
      const matchedRider = riders?.find((r) => r.phone && phoneDigits(r.phone) === slackDigits);
      const matchedCoach = coaches?.find((c) => c.phone && phoneDigits(c.phone) === slackDigits);
      if (matchedRider || matchedCoach) {
        console.log(`Matched by phone: ${slackDigits}`);
        return { riderId: matchedRider?.id ?? null, coachId: matchedCoach?.id ?? null, matchedBy: "phone" };
      }
    }
  }

  // Strategy 3: Name
  const namesToTry = [profile.realName, profile.displayName].filter(Boolean) as string[];
  for (const name of namesToTry) {
    const [{ data: riders }, { data: coaches }] = await Promise.all([
      supabase.from("riders").select("id").ilike("name", name),
      supabase.from("coaches").select("id").ilike("name", name),
    ]);
    const riderId = riders?.[0]?.id ?? null;
    const coachId = coaches?.[0]?.id ?? null;
    if (riderId || coachId) {
      console.log(`Matched by name: "${name}"`);
      return { riderId, coachId, matchedBy: "name" };
    }
  }

  console.log(`No match: email=${profile.email}, name=${profile.realName}, phone=${profile.phone}`);
  return { riderId: null, coachId: null, matchedBy: null };
}

function noMatchMessage(profile: SlackProfile): string {
  return `Could not find you in TeamRide Pro. Your Slack profile shows: email=${profile.email ?? "none"}, name="${profile.realName ?? "none"}", phone=${profile.phone ?? "none"}. Make sure at least one of these matches your TeamRide Pro profile, or ask an admin to update it.`;
}

// =============================================================================
// HELPERS — Database
// =============================================================================

async function getNextRide(supabase: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rides, error } = await supabase
    .from("rides")
    .select("id, date, available_riders, available_coaches, cancelled")
    .eq("cancelled", false)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);
  if (error) { console.error("Error fetching rides:", error); return null; }
  return rides?.[0] ?? null;
}

async function getRideById(supabase: ReturnType<typeof createClient>, rideId: number) {
  const { data, error } = await supabase
    .from("rides")
    .select("id, date, available_riders, available_coaches, cancelled")
    .eq("id", rideId)
    .single();
  if (error) { console.error("Error fetching ride:", error); return null; }
  return data;
}

/** Get practice time from season_settings for a given date's day-of-week */
async function getPracticeTime(supabase: ReturnType<typeof createClient>, dateStr: string): Promise<string | null> {
  try {
    const d = new Date(dateStr + "T12:00:00");
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
    const { data } = await supabase
      .from("season_settings")
      .select("practices")
      .eq("id", "current")
      .single();
    if (data?.practices && Array.isArray(data.practices)) {
      const match = data.practices.find((p: any) => p.dayOfWeek === dayOfWeek);
      if (match?.time) return match.time; // e.g. "15:30"
    }
  } catch (e) {
    console.error("Error fetching practice time:", e);
  }
  return null;
}

/** Format "15:30" → "3:30 PM" */
function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

async function updateAttendance(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  riderId: number | null,
  coachId: number | null,
  action: "add" | "remove"
): Promise<boolean> {
  const ride = await getRideById(supabase, rideId);
  if (!ride) return false;
  const availableRiders: number[] = Array.isArray(ride.available_riders) ? [...ride.available_riders] : [];
  const availableCoaches: number[] = Array.isArray(ride.available_coaches) ? [...ride.available_coaches] : [];
  let changed = false;
  if (riderId) {
    if (action === "add" && !availableRiders.includes(riderId)) { availableRiders.push(riderId); changed = true; }
    else if (action === "remove" && availableRiders.includes(riderId)) { availableRiders.splice(availableRiders.indexOf(riderId), 1); changed = true; }
  }
  if (coachId) {
    if (action === "add" && !availableCoaches.includes(coachId)) { availableCoaches.push(coachId); changed = true; }
    else if (action === "remove" && availableCoaches.includes(coachId)) { availableCoaches.splice(availableCoaches.indexOf(coachId), 1); changed = true; }
  }
  if (changed) {
    const { error } = await supabase.from("rides").update({ available_riders: availableRiders, available_coaches: availableCoaches }).eq("id", rideId);
    if (error) { console.error("Error updating attendance:", error); return false; }
  }
  return true;
}

async function saveAbsenceReason(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  riderId: number | null,
  coachId: number | null,
  reason: string
): Promise<void> {
  const row: Record<string, unknown> = {
    ride_id: rideId,
    note: reason.trim(),
    created_at: new Date().toISOString(),
  };
  if (riderId) { row.rider_id = riderId; } else { row.coach_id = coachId; }
  const onConflict = riderId ? "ride_id,rider_id" : "ride_id,coach_id";
  const { error } = await supabase.from("ride_rider_slack_notes").upsert(row, { onConflict });
  if (error) console.error("Error saving absence reason:", error);
  else console.log(`Reason saved for ${riderId ? "rider " + riderId : "coach " + coachId} on ride ${rideId}`);
}

// =============================================================================
// HELPERS — Poll response tracking & live tally
// =============================================================================

/** Upsert a poll response (who answered and whether they're attending) */
async function trackPollResponse(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  slackUserId: string,
  riderId: number | null,
  coachId: number | null,
  attending: boolean
): Promise<void> {
  const row: Record<string, unknown> = {
    ride_id: rideId,
    slack_user_id: slackUserId,
    attending,
    responded_at: new Date().toISOString(),
  };
  if (riderId) row.rider_id = riderId;
  if (coachId) row.coach_id = coachId;

  const { error } = await supabase
    .from("slack_poll_responses")
    .upsert(row, { onConflict: "ride_id,slack_user_id" });
  if (error) console.error("Error tracking poll response:", error);
  else console.log(`Poll response tracked: ride=${rideId}, user=${slackUserId}, attending=${attending}`);
}

/** Count active (non-archived) riders + coaches */
async function getActiveRosterCount(supabase: ReturnType<typeof createClient>): Promise<number> {
  const [{ count: riderCount }, { count: coachCount }] = await Promise.all([
    supabase.from("riders").select("id", { count: "exact", head: true }).or("archived.is.null,archived.eq.false"),
    supabase.from("coaches").select("id", { count: "exact", head: true }).or("archived.is.null,archived.eq.false"),
  ]);
  return (riderCount ?? 0) + (coachCount ?? 0);
}

/** Update every posted poll message for this ride with a live response tally */
async function updatePollTally(
  supabase: ReturnType<typeof createClient>,
  rideId: number
): Promise<void> {
  // Find all posted poll messages for this ride
  const { data: polls } = await supabase
    .from("slack_attendance_polls")
    .select("channel_id, message_ts")
    .eq("ride_id", rideId);

  if (!polls || polls.length === 0) {
    console.log(`No poll messages found for ride ${rideId}, skipping tally update`);
    return;
  }

  // Count responses
  const { data: responses } = await supabase
    .from("slack_poll_responses")
    .select("attending")
    .eq("ride_id", rideId);

  const attendingCount = responses?.filter((r) => r.attending).length ?? 0;
  const notAttendingCount = responses?.filter((r) => !r.attending).length ?? 0;
  const totalRoster = await getActiveRosterCount(supabase);
  const noResponseCount = Math.max(0, totalRoster - attendingCount - notAttendingCount);

  // Get ride info to rebuild the message blocks
  const ride = await getRideById(supabase, rideId);
  if (!ride) return;

  const timeStr = await getPracticeTime(supabase, ride.date);
  const tally = { attending: attendingCount, notAttending: notAttendingCount, noResponse: noResponseCount };
  const updatedPoll = buildPollMessage(rideId, ride.date, timeStr, tally);

  // Update each posted poll message with the new tally
  for (const poll of polls) {
    const res = await fetch("https://slack.com/api/chat.update", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: poll.channel_id,
        ts: poll.message_ts,
        text: updatedPoll.text,
        blocks: updatedPoll.blocks,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error(`chat.update error for ${poll.channel_id}:`, data.error);
    else console.log(`Tally updated: ${attendingCount} yes, ${notAttendingCount} no, ${noResponseCount} pending`);
  }
}

// =============================================================================
// HELPERS — Slack UI builders
// =============================================================================

/** Step 1: Channel message with "Confirm Attendance" button + optional live tally */
function buildPollMessage(
  rideId: number,
  dateStr: string,
  timeStr: string | null,
  tally?: { attending: number; notAttending: number; noResponse: number }
) {
  const friendlyDate = formatDate(dateStr);
  const timeDisplay = timeStr ? ` at ${formatTime12h(timeStr)}` : "";
  const headline = `Please confirm your attendance for practice on *${friendlyDate}*${timeDisplay}`;

  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `:clipboard: ${headline}` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Confirm Attendance", emoji: true },
          style: "primary",
          action_id: "confirm_attendance",
          value: `confirm_${rideId}`,
        },
      ],
    },
  ];

  // Append live tally if we have response data
  if (tally) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_${tally.attending} attending · ${tally.notAttending} not attending · ${tally.noResponse} not yet responded_`,
        },
      ],
    });
  }

  return {
    // <!channel> notifies all channel members when the poll is first posted
    text: `<!channel> Attendance confirmation: Practice ${friendlyDate}`,
    blocks,
  };
}

/** Step 2: Modal with attend/not-attend radio buttons + conditional reason field */
function buildAttendanceModal(rideId: number, dateStr: string, timeStr: string | null, showReason: boolean) {
  const friendlyDate = formatDate(dateStr);
  const timeDisplay = timeStr ? ` at ${formatTime12h(timeStr)}` : "";

  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Practice:* ${friendlyDate}${timeDisplay}` },
    },
    {
      type: "input",
      block_id: "choice_block",
      dispatch_action: true,
      element: {
        type: "radio_buttons",
        action_id: "attendance_choice",
        options: [
          {
            text: { type: "plain_text", text: "I will attend", emoji: true },
            value: "attend",
          },
          {
            text: { type: "plain_text", text: "I will not attend", emoji: true },
            value: "absent",
          },
        ],
      },
      label: { type: "plain_text", text: "Will you attend this practice?" },
    },
  ];

  if (showReason) {
    blocks.push({
      type: "input",
      block_id: "reason_block",
      element: {
        type: "plain_text_input",
        action_id: "reason_input",
        multiline: false,
        placeholder: { type: "plain_text", text: "e.g., Doctor appointment, family event..." },
      },
      label: { type: "plain_text", text: "Reason for missing practice (required)" },
    });
  }

  return {
    type: "modal" as const,
    callback_id: `attendance_${rideId}`,
    // Encode time in private_metadata so we can rebuild the modal on update
    private_metadata: JSON.stringify({ rideId, dateStr, timeStr }),
    title: { type: "plain_text" as const, text: "Confirm Attendance" },
    submit: { type: "plain_text" as const, text: "Submit" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks,
  };
}

/** Step 3: Ephemeral confirmation blocks with Update Response button */
function buildConfirmationBlocks(rideId: number, dateStr: string, attending: boolean, reason?: string) {
  const friendlyDate = formatDate(dateStr);
  const emoji = attending ? ":white_check_mark:" : ":x:";
  const status = attending ? "Attending" : "Not attending";

  let text = `${emoji} *Response recorded*\n*Practice:* ${friendlyDate}\n*Status:* ${status}`;
  if (!attending && reason) {
    text += `\n*Reason:* ${reason}`;
  }

  return {
    response_type: "ephemeral",
    replace_original: false,
    text: `Response recorded: ${status} for ${friendlyDate}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Update Response", emoji: true },
            action_id: "update_response",
            value: `update_${rideId}`,
          },
        ],
      },
    ],
  };
}

// =============================================================================
// Post poll to channel
// =============================================================================

async function postPollToChannel(
  supabase: ReturnType<typeof createClient>,
  channelId: string,
  rideId: number,
  dateStr: string
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !channelId) {
    console.error("Missing SLACK_BOT_TOKEN or channel ID");
    return false;
  }
  const timeStr = await getPracticeTime(supabase, dateStr);
  const poll = buildPollMessage(rideId, dateStr, timeStr);
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channelId, text: poll.text, blocks: poll.blocks }),
  });
  const data = await res.json();
  if (!data.ok) { console.error("chat.postMessage error:", data.error); return false; }

  // Save the message reference so we can update it with the live tally later
  if (data.ts) {
    const { error: pollErr } = await supabase.from("slack_attendance_polls").upsert(
      { ride_id: rideId, channel_id: channelId, message_ts: data.ts },
      { onConflict: "ride_id,channel_id" }
    );
    if (pollErr) console.error("Error saving poll reference:", pollErr);
    else console.log(`Poll reference saved: ride=${rideId}, channel=${channelId}, ts=${data.ts}`);
  }

  console.log(`Poll posted to ${channelId} for ride ${rideId}`);
  return true;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Cron-Secret" },
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  // =========================================================================
  // PATH 1: Cron-triggered poll posting
  // =========================================================================
  const cronSecret = req.headers.get("X-Cron-Secret");
  if (cronSecret && contentType.includes("application/json")) {
    if (!CRON_SECRET || cronSecret !== CRON_SECRET) return new Response("Unauthorized", { status: 401 });
    const body = JSON.parse(rawBody);
    const jsonResponse = (obj: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

    // --- post_poll: post immediately for the next upcoming practice ---
    if (body.action === "post_poll") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const ride = await getNextRide(supabase);
      if (!ride) return jsonResponse({ error: "No upcoming practice found" });

      const results: string[] = [];
      if (SLACK_ATTENDANCE_CHANNEL_ID) {
        results.push((await postPollToChannel(supabase, SLACK_ATTENDANCE_CHANNEL_ID, ride.id, ride.date)) ? "Rider poll posted" : "Rider poll failed");
      }
      if (SLACK_COACH_CHANNEL_ID && SLACK_COACH_CHANNEL_ID !== SLACK_ATTENDANCE_CHANNEL_ID) {
        results.push((await postPollToChannel(supabase, SLACK_COACH_CHANNEL_ID, ride.id, ride.date)) ? "Coach poll posted" : "Coach poll failed");
      }
      return jsonResponse({ success: true, results, rideId: ride.id, date: ride.date });
    }

    // --- post_poll_if_tomorrow: only post if next practice is tomorrow (for daily cron) ---
    if (body.action === "post_poll_if_tomorrow") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const ride = await getNextRide(supabase);
      if (!ride) return jsonResponse({ skipped: true, reason: "No upcoming practice found" });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      if (ride.date !== tomorrowStr) {
        return jsonResponse({ skipped: true, reason: `Next practice is ${ride.date}, not tomorrow (${tomorrowStr})` });
      }

      // Check if a poll was already posted for this ride (prevent duplicates)
      const { data: existing } = await supabase
        .from("slack_attendance_polls")
        .select("id")
        .eq("ride_id", ride.id)
        .limit(1);
      if (existing && existing.length > 0) {
        return jsonResponse({ skipped: true, reason: `Poll already posted for ride ${ride.id}` });
      }

      const results: string[] = [];
      if (SLACK_ATTENDANCE_CHANNEL_ID) {
        results.push((await postPollToChannel(supabase, SLACK_ATTENDANCE_CHANNEL_ID, ride.id, ride.date)) ? "Rider poll posted" : "Rider poll failed");
      }
      if (SLACK_COACH_CHANNEL_ID && SLACK_COACH_CHANNEL_ID !== SLACK_ATTENDANCE_CHANNEL_ID) {
        results.push((await postPollToChannel(supabase, SLACK_COACH_CHANNEL_ID, ride.id, ride.date)) ? "Coach poll posted" : "Coach poll failed");
      }
      return jsonResponse({ success: true, results, rideId: ride.id, date: ride.date });
    }

    // --- send_reminders: DM non-responders for the next practice ---
    if (body.action === "send_reminders") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const ride = await getNextRide(supabase);
      if (!ride) return jsonResponse({ skipped: true, reason: "No upcoming practice found" });

      // Get all who HAVE responded for this ride
      const { data: responses } = await supabase
        .from("slack_poll_responses")
        .select("slack_user_id")
        .eq("ride_id", ride.id);
      const respondedUsers = new Set(responses?.map((r) => r.slack_user_id) ?? []);

      // Build person → slack_user_id map from ALL historical responses
      const { data: pastResponses } = await supabase
        .from("slack_poll_responses")
        .select("slack_user_id, rider_id, coach_id");
      const riderSlackMap = new Map<number, string>();
      const coachSlackMap = new Map<number, string>();
      for (const r of pastResponses ?? []) {
        if (r.rider_id) riderSlackMap.set(r.rider_id, r.slack_user_id);
        if (r.coach_id) coachSlackMap.set(r.coach_id, r.slack_user_id);
      }

      // Get active roster
      const [{ data: riders }, { data: coaches }] = await Promise.all([
        supabase.from("riders").select("id").or("archived.is.null,archived.eq.false"),
        supabase.from("coaches").select("id").or("archived.is.null,archived.eq.false"),
      ]);

      // Find non-responders who have a known Slack user ID
      const reminderTargets: string[] = [];
      for (const rider of riders ?? []) {
        const slackId = riderSlackMap.get(rider.id);
        if (slackId && !respondedUsers.has(slackId)) reminderTargets.push(slackId);
      }
      for (const coach of coaches ?? []) {
        const slackId = coachSlackMap.get(coach.id);
        if (slackId && !respondedUsers.has(slackId)) reminderTargets.push(slackId);
      }

      if (reminderTargets.length === 0) {
        return jsonResponse({ success: true, reminders_sent: 0, reason: "Everyone has responded (or no Slack IDs on file)" });
      }

      // Send DM reminders
      const timeStr = await getPracticeTime(supabase, ride.date);
      const friendlyDate = formatDate(ride.date);
      const timeDisplay = timeStr ? ` at ${formatTime12h(timeStr)}` : "";
      let sent = 0;

      for (const userId of reminderTargets) {
        try {
          // Open a DM channel with the user
          const openRes = await fetch("https://slack.com/api/conversations.open", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ users: userId }),
          });
          const openData = await openRes.json();
          if (!openData.ok) { console.error(`conversations.open error for ${userId}:`, openData.error); continue; }

          const dmChannelId = openData.channel.id;

          // Send a reminder with the Confirm Attendance button
          const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: dmChannelId,
              text: `Reminder: Please confirm attendance for practice on ${friendlyDate}`,
              blocks: [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: `:wave: Reminder: Please confirm your attendance for practice on *${friendlyDate}*${timeDisplay}` },
                },
                {
                  type: "actions",
                  elements: [{
                    type: "button",
                    text: { type: "plain_text", text: "Confirm Attendance", emoji: true },
                    style: "primary",
                    action_id: "confirm_attendance",
                    value: `confirm_${ride.id}`,
                  }],
                },
              ],
            }),
          });
          const msgData = await msgRes.json();
          if (msgData.ok) sent++;
          else console.error(`DM send error for ${userId}:`, msgData.error);
        } catch (e) {
          console.error(`Error sending reminder to ${userId}:`, e);
        }
      }

      return jsonResponse({ success: true, rideId: ride.id, reminders_sent: sent, non_responders: reminderTargets.length });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // =========================================================================
  // Verify Slack signature for all Slack requests
  // =========================================================================
  const signature = req.headers.get("X-Slack-Signature");
  const timestamp = req.headers.get("X-Slack-Request-Timestamp");
  if (!(await verifySlackRequest(rawBody, signature, timestamp))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const form = parseFormBody(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // =========================================================================
  // PATH 2: Interaction payloads (buttons, radio buttons, modal submissions)
  // =========================================================================
  if (form.payload) {
    const payload = JSON.parse(form.payload);
    const payloadType = payload.type;
    const slackUserId = payload.user?.id;

    // --- BLOCK ACTIONS (button clicks & radio button changes) ---
    if (payloadType === "block_actions") {
      const action = payload.actions?.[0];
      if (!slackUserId || !action) return new Response("", { status: 200 });

      const actionId = action.action_id;
      const actionValue = action.value ?? "";

      // ----- "Confirm Attendance" button (Step 1 → Step 2) -----
      if (actionId === "confirm_attendance" || actionId === "update_response") {
        const rideId = parseInt(actionValue.split("_")[1], 10);
        if (isNaN(rideId)) return new Response("", { status: 200 });

        const triggerId = payload.trigger_id;
        if (!triggerId) return ephemeral("Could not open attendance form.");

        // Get ride date and practice time for the modal header
        const ride = await getRideById(supabase, rideId);
        if (!ride) return ephemeral("Could not find that practice.");

        const timeStr = await getPracticeTime(supabase, ride.date);
        const modal = buildAttendanceModal(rideId, ride.date, timeStr, false);

        const res = await fetch("https://slack.com/api/views.open", {
          method: "POST",
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_id: triggerId, view: modal }),
        });
        const resData = await res.json();
        if (!resData.ok) console.error("views.open error:", resData.error);

        return new Response("", { status: 200 });
      }

      // ----- Radio button changed inside modal (show/hide reason field) -----
      if (actionId === "attendance_choice") {
        const selectedValue = action.selected_option?.value; // "attend" or "absent"
        const viewId = payload.view?.id;
        const viewHash = payload.view?.hash;
        const metadata = payload.view?.private_metadata;

        if (!viewId || !metadata) return new Response("", { status: 200 });

        const { rideId, dateStr, timeStr } = JSON.parse(metadata);
        const showReason = selectedValue === "absent";
        const updatedModal = buildAttendanceModal(rideId, dateStr, timeStr, showReason);

        const res = await fetch("https://slack.com/api/views.update", {
          method: "POST",
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ view_id: viewId, hash: viewHash, view: updatedModal }),
        });
        const resData = await res.json();
        if (!resData.ok) console.error("views.update error:", resData.error);

        return new Response("", { status: 200 });
      }

      // Unknown action — acknowledge
      return new Response("", { status: 200 });
    }

    // --- VIEW SUBMISSION (modal submitted) ---
    if (payloadType === "view_submission") {
      const callbackId = payload.view?.callback_id ?? "";
      const values = payload.view?.state?.values ?? {};
      const metadata = payload.view?.private_metadata;

      // ----- Attendance modal submission -----
      if (callbackId.startsWith("attendance_")) {
        const rideId = parseInt(callbackId.replace("attendance_", ""), 10);
        if (isNaN(rideId) || !slackUserId) {
          return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        const choice = values?.choice_block?.attendance_choice?.selected_option?.value; // "attend" or "absent"

        if (!choice) {
          // No selection made — show validation error
          return new Response(JSON.stringify({
            response_action: "errors",
            errors: { choice_block: "Please select whether you will attend or not." },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        const attending = choice === "attend";
        const reason = values?.reason_block?.reason_input?.value?.trim() ?? "";

        // Validate: reason is required if not attending
        if (!attending && !reason) {
          return new Response(JSON.stringify({
            response_action: "errors",
            errors: { reason_block: "Please provide a reason for missing practice." },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Look up the person
        const profile = await getSlackProfile(slackUserId);
        if (!profile) {
          return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        const { riderId, coachId } = await findPerson(supabase, profile);
        if (!riderId && !coachId) {
          return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Update attendance on the ride record
        await updateAttendance(supabase, rideId, riderId, coachId, attending ? "add" : "remove");

        // Save absence reason if not attending
        if (!attending && reason) {
          await saveAbsenceReason(supabase, rideId, riderId, coachId, reason);
        }

        // Track the poll response and update the live tally on the original message
        await trackPollResponse(supabase, rideId, slackUserId, riderId, coachId, attending);
        // Fire-and-forget tally update (don't block the modal response)
        updatePollTally(supabase, rideId).catch((e) => console.error("Tally update error:", e));

        // Get ride date for confirmation
        const ride = await getRideById(supabase, rideId);
        const dateStr = ride?.date ?? (metadata ? JSON.parse(metadata).dateStr : "unknown");

        // Send ephemeral confirmation with Update Response button
        // Determine which channel this person belongs to (rider → rider channel, coach → coach channel)
        try {
          const channelId = coachId && !riderId && SLACK_COACH_CHANNEL_ID
            ? SLACK_COACH_CHANNEL_ID
            : SLACK_ATTENDANCE_CHANNEL_ID || SLACK_COACH_CHANNEL_ID;
          if (channelId) {
            const confirmation = buildConfirmationBlocks(rideId, dateStr, attending, reason || undefined);
            await fetch("https://slack.com/api/chat.postEphemeral", {
              method: "POST",
              headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                channel: channelId,
                user: slackUserId,
                text: confirmation.text,
                blocks: confirmation.blocks,
              }),
            });
          }
        } catch (e) {
          console.error("Error posting confirmation:", e);
        }

        return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Unknown modal — close it
      return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response("", { status: 200 });
  }

  // =========================================================================
  // PATH 3: Slash commands
  // =========================================================================
  const command = form.command ?? "";
  const slackUserId = form.user_id ?? "";

  // --- /post-poll: post attendance poll to channel ---
  if (command === "/post-poll") {
    const ride = await getNextRide(supabase);
    if (!ride) return ephemeral("No upcoming practice found.");

    const results: string[] = [];
    if (SLACK_ATTENDANCE_CHANNEL_ID) {
      results.push((await postPollToChannel(supabase, SLACK_ATTENDANCE_CHANNEL_ID, ride.id, ride.date)) ? "Rider poll posted" : "Rider poll failed");
    }
    if (SLACK_COACH_CHANNEL_ID && SLACK_COACH_CHANNEL_ID !== SLACK_ATTENDANCE_CHANNEL_ID) {
      results.push((await postPollToChannel(supabase, SLACK_COACH_CHANNEL_ID, ride.id, ride.date)) ? "Coach poll posted" : "Coach poll failed");
    }
    if (results.length === 0) return ephemeral("No channel IDs configured. Set SLACK_ATTENDANCE_CHANNEL_ID and/or SLACK_COACH_CHANNEL_ID in Supabase secrets.");
    return ephemeral(`Poll posted for ${formatDate(ride.date)} (ride #${ride.id}). ${results.join(", ")}.`);
  }

  // --- /attend: quick mark-attending for next practice ---
  if (!slackUserId) return ephemeral("Could not identify Slack user.");
  if (!SLACK_BOT_TOKEN) return ephemeral("Slack bot token not configured. Ask an admin to set SLACK_BOT_TOKEN.");

  const profile = await getSlackProfile(slackUserId);
  if (!profile) return ephemeral("Could not read your Slack profile. Ask an admin to check the bot token.");

  const { riderId, coachId } = await findPerson(supabase, profile);
  if (!riderId && !coachId) return ephemeral(noMatchMessage(profile));

  const ride = await getNextRide(supabase);
  if (!ride) return ephemeral("No upcoming practice found.");

  const updated = await updateAttendance(supabase, ride.id, riderId, coachId, "add");
  const friendlyDate = formatDate(ride.date);

  if (updated) {
    // Track the response and update tally (fire-and-forget)
    trackPollResponse(supabase, ride.id, slackUserId, riderId, coachId, true).catch((e) => console.error("Track error:", e));
    updatePollTally(supabase, ride.id).catch((e) => console.error("Tally error:", e));
  }

  return updated
    ? ephemeral(`You're marked in for practice on ${friendlyDate}. See you there!`)
    : ephemeral(`There was a problem updating attendance for ${friendlyDate}. Please try again or contact an admin.`);
});
