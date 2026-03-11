// supabase/functions/slack-attendance/index.ts
// Slack attendance poll with 3-step flow:
//   1. Channel message with @channel + [Respond for this Practice] + [Mark Future Attendance...]
//   2. Modal: "I will attend" / "I will not attend" (+ "Can attend if needed" for coaches)
//      Coaches get optional "Comments/Requests" field (100 char). Riders get mandatory reason for absent.
//   3. Ephemeral confirmation with timestamp + [Change Response] button
//
// "Mark Future Practices" opens a multi-ride modal to pre-mark attendance for all upcoming practices.
// Pre-responses show up when the scheduled poll arrives (modal pre-fills + tally includes them).
//
// Live tally: original poll message updates with "X attending · Y if needed · Z not attending · W not yet responded"
// Coach "if needed" status stored in rides.settings.coachIfNeeded for practice planner integration
//
// Also handles:
//   - /attend slash command (quick mark-attending)
//   - /post-poll slash command (post poll to channel)
//   - Cross-channel guard: coaches blocked from rider poll, riders blocked from coach poll
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
  // All lookups filter out archived records so stale duplicates don't shadow active ones
  const notArchived = "archived.is.null,archived.eq.false";

  // Strategy 1: Email
  if (profile.email) {
    const [{ data: riders }, { data: coaches }] = await Promise.all([
      supabase.from("riders").select("id").ilike("email", profile.email).or(notArchived),
      supabase.from("coaches").select("id").ilike("email", profile.email).or(notArchived),
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
        supabase.from("riders").select("id, phone").not("phone", "is", null).or(notArchived),
        supabase.from("coaches").select("id, phone").not("phone", "is", null).or(notArchived),
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
      supabase.from("riders").select("id").ilike("name", name).or(notArchived),
      supabase.from("coaches").select("id").ilike("name", name).or(notArchived),
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

/** Get the next upcoming ride that matches a planned practice day.
 *  A ride is a "planned practice" if its date matches a season_settings practice
 *  (by specificDate or by dayOfWeek) and that practice is not excludeFromPlanner. */
async function getNextRide(supabase: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch practices from season_settings to know which days are planned
  const { data: settingsRow } = await supabase
    .from("season_settings")
    .select("practices")
    .eq("id", "current")
    .single();
  const practices: any[] = Array.isArray(settingsRow?.practices) ? settingsRow.practices : [];

  // Fetch the next several upcoming rides (we may need to skip non-practice rides)
  // Filter out both cancelled and deleted rides (handle null values — many rides have null instead of false)
  const { data: rides, error } = await supabase
    .from("rides")
    .select("id, date, available_riders, available_coaches, cancelled, deleted, published_groups")
    .or("cancelled.is.null,cancelled.eq.false")
    .or("deleted.is.null,deleted.eq.false")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(20);
  if (error) { console.error("Error fetching rides:", error); return null; }
  if (!rides || rides.length === 0) return null;

  // If no practices are configured, fall back to first ride (backward compat)
  if (practices.length === 0) {
    console.log("No practices configured in season_settings — using first upcoming ride");
    return rides[0];
  }

  // Find the first ride that matches a non-excluded practice
  for (const ride of rides) {
    if (isPlannedPractice(ride.date, practices)) return ride;
  }

  console.log("No upcoming rides match a planned practice day");
  return null;
}

/** Get all upcoming planned rides (for "Mark Future Practices" modal). Skips the very next practice. */
async function getUpcomingPlannedRides(
  supabase: ReturnType<typeof createClient>,
  limit: number = 25
): Promise<Array<{ id: number; date: string }>> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: settingsRow } = await supabase
    .from("season_settings")
    .select("practices")
    .eq("id", "current")
    .single();
  const practices: any[] = Array.isArray(settingsRow?.practices) ? settingsRow.practices : [];

  // Filter out both cancelled and deleted rides (handle null values — many rides have null instead of false)
  const { data: rides, error } = await supabase
    .from("rides")
    .select("id, date")
    .or("cancelled.is.null,cancelled.eq.false")
    .or("deleted.is.null,deleted.eq.false")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(50);
  if (error || !rides) return [];

  // Filter to planned practices only
  const planned = practices.length > 0
    ? rides.filter(r => isPlannedPractice(r.date, practices))
    : rides;

  // Deduplicate: keep only the first ride per date (prevents duplicate entries in modal)
  const seenDates = new Set<string>();
  const deduped = planned.filter(r => {
    if (seenDates.has(r.date)) return false;
    seenDates.add(r.date);
    return true;
  });

  // Skip the first one (it's the current/next practice which has its own poll)
  return deduped.slice(1, 1 + limit);
}

/** Check if a date matches a planned (non-excluded) practice */
function isPlannedPractice(dateStr: string, practices: any[]): boolean {
  // Check specific-date practices first
  const specificMatch = practices.find(
    (p: any) => p.specificDate === dateStr && !p.excludeFromPlanner
  );
  if (specificMatch) return true;

  // Check recurring day-of-week practices
  const d = new Date(dateStr + "T12:00:00");
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
  const recurringMatch = practices.find((p: any) => {
    const pDow = typeof p.dayOfWeek === "string" ? parseInt(p.dayOfWeek, 10) : p.dayOfWeek;
    const hasSpecificDate = p.specificDate != null && p.specificDate !== undefined && p.specificDate !== "";
    return Number(pDow) === dayOfWeek && !hasSpecificDate && !p.excludeFromPlanner;
  });
  return !!recurringMatch;
}

async function getRideById(supabase: ReturnType<typeof createClient>, rideId: number) {
  const { data, error } = await supabase
    .from("rides")
    .select("id, date, available_riders, available_coaches, cancelled, groups, published_groups")
    .eq("id", rideId)
    .single();
  if (error) { console.error("Error fetching ride:", error); return null; }
  return data;
}

/** Get practice start/end times from season_settings for a given date */
async function getPracticeTimes(
  supabase: ReturnType<typeof createClient>, dateStr: string
): Promise<{ startTime: string | null; endTime: string | null }> {
  try {
    const { data } = await supabase
      .from("season_settings")
      .select("practices")
      .eq("id", "current")
      .single();
    if (data?.practices && Array.isArray(data.practices)) {
      // Check specific-date practice first
      const specificMatch = data.practices.find((p: any) => p.specificDate === dateStr);
      if (specificMatch?.time) return { startTime: specificMatch.time, endTime: specificMatch.endTime || null };

      // Check recurring day-of-week practice
      const d = new Date(dateStr + "T12:00:00");
      const dayOfWeek = d.getDay();
      const recurringMatch = data.practices.find((p: any) => {
        const pDow = typeof p.dayOfWeek === "string" ? parseInt(p.dayOfWeek, 10) : p.dayOfWeek;
        const hasSpecificDate = p.specificDate != null && p.specificDate !== undefined && p.specificDate !== "";
        return Number(pDow) === dayOfWeek && !hasSpecificDate;
      });
      if (recurringMatch?.time) return { startTime: recurringMatch.time, endTime: recurringMatch.endTime || null };
    }
  } catch (e) {
    console.error("Error fetching practice times:", e);
  }
  return { startTime: null, endTime: null };
}

/** Compute practice times from an already-fetched practices array (pure, no DB call) */
function computeTimesForDate(
  practices: any[], dateStr: string
): { startTime: string | null; endTime: string | null } {
  const specificMatch = practices.find((p: any) => p.specificDate === dateStr);
  if (specificMatch?.time) return { startTime: specificMatch.time, endTime: specificMatch.endTime || null };

  const d = new Date(dateStr + "T12:00:00");
  const dayOfWeek = d.getDay();
  const recurringMatch = practices.find((p: any) => {
    const pDow = typeof p.dayOfWeek === "string" ? parseInt(p.dayOfWeek, 10) : p.dayOfWeek;
    const hasSpecificDate = p.specificDate != null && p.specificDate !== undefined && p.specificDate !== "";
    return Number(pDow) === dayOfWeek && !hasSpecificDate;
  });
  if (recurringMatch?.time) return { startTime: recurringMatch.time, endTime: recurringMatch.endTime || null };

  return { startTime: null, endTime: null };
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

/** Format "15:30" → "3:30pm" (compact lowercase, no space) */
function formatTimeCompact(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "pm" : "am";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  // Omit :00 for even hours → "3pm" instead of "3:00pm"
  return m === "00" ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}

/** Format a time range: "from 3:40-6pm" or "from 3:40-6:30pm" or "at 3:40pm" (no end time) */
function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime) return "";
  if (endTime) return ` from ${formatTimeCompact(startTime)}-${formatTimeCompact(endTime)}`;
  return ` at ${formatTimeCompact(startTime)}`;
}

/** Format a time range for parenthesized display: "9am - 2pm" (no "from", spaces around dash) */
function formatTimeRangeParens(startTime: string | null, endTime: string | null): string {
  if (!startTime) return "";
  if (endTime) return `${formatTimeCompact(startTime)} - ${formatTimeCompact(endTime)}`;
  return formatTimeCompact(startTime);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/** Format current time as "Mon 3/9 @ 5:15pm" in Pacific time */
function formatNowTimestamp(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short", month: "numeric", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("month")}/${get("day")} @ ${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase()}`;
}

/** Get current date, hour, and minute in Pacific time */
function getCurrentPacificTime(): { date: string; hour: number; minute: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "numeric", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "0";
  const year = get("year");
  const month = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // Intl can return 24 for midnight in hour12:false
  return { date: `${year}-${month}-${day}`, hour, minute: parseInt(get("minute"), 10) };
}

/**
 * Calculate the ideal reminder time for a practice, counting back `leadHours`
 * of "notification window" time (9 AM – 8 PM Pacific). If the practice starts
 * outside the window, the effective start is clamped to the nearest window edge.
 *
 * Returns { date: "YYYY-MM-DD", hour: number, minute: number } in Pacific time.
 * If no practice time is available, falls back to 8 AM on practice day.
 */
function calculateReminderTime(
  practiceDate: string,
  practiceStartTime: string | null,
  leadHours: number = 4
): { date: string; hour: number; minute: number } {
  const WINDOW_START = 9;  // 9 AM
  const WINDOW_END = 20;   // 8 PM

  // Fallback: no practice time → 8 AM on practice day (preserves legacy behavior)
  if (!practiceStartTime) {
    return { date: practiceDate, hour: 8, minute: 0 };
  }

  // Parse "HH:MM" → decimal hours (e.g., "15:30" → 15.5)
  const [hStr, mStr] = practiceStartTime.split(":");
  const practiceHour = parseInt(hStr, 10);
  const practiceMinute = parseInt(mStr || "0", 10);
  const practiceDecimal = practiceHour + practiceMinute / 60;

  // Determine effective start date and hour within the notification window
  let effectiveDate = practiceDate;
  let effectiveDecimal: number;

  if (practiceDecimal >= WINDOW_END) {
    // Practice starts at or after 8 PM → clamp to 8 PM same day
    effectiveDecimal = WINDOW_END;
  } else if (practiceDecimal < WINDOW_START) {
    // Practice starts before 9 AM → clamp to 8 PM previous day
    const d = new Date(practiceDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    effectiveDate = d.toISOString().slice(0, 10);
    effectiveDecimal = WINDOW_END;
  } else {
    // Practice is within the window
    effectiveDecimal = practiceDecimal;
  }

  // Subtract leadHours within notification windows
  let reminderDecimal = effectiveDecimal - leadHours;
  let reminderDate = effectiveDate;

  if (reminderDecimal < WINDOW_START) {
    // Overflows into previous day's notification window
    const overflow = WINDOW_START - reminderDecimal; // hours that spilled past 9 AM
    const prevDay = new Date(reminderDate + "T12:00:00");
    prevDay.setDate(prevDay.getDate() - 1);
    reminderDate = prevDay.toISOString().slice(0, 10);
    reminderDecimal = WINDOW_END - overflow;
  }

  // Convert decimal back to hour:minute
  const reminderHour = Math.floor(reminderDecimal);
  const reminderMinute = Math.round((reminderDecimal - reminderHour) * 60);

  return { date: reminderDate, hour: reminderHour, minute: reminderMinute };
}

async function updateAttendance(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  riderId: number | null,
  coachId: number | null,
  action: "add" | "remove"
): Promise<boolean> {
  console.log(`[updateAttendance] START: rideId=${rideId}, riderId=${riderId}, coachId=${coachId}, action=${action}`);
  const ride = await getRideById(supabase, rideId);
  if (!ride) { console.error(`[updateAttendance] getRideById returned null for rideId=${rideId}`); return false; }
  const availableRiders: number[] = Array.isArray(ride.available_riders) ? [...ride.available_riders] : [];
  const availableCoaches: number[] = Array.isArray(ride.available_coaches) ? [...ride.available_coaches] : [];
  console.log(`[updateAttendance] Before: riders=${JSON.stringify(availableRiders)}, coaches=${JSON.stringify(availableCoaches)}`);
  let changed = false;
  if (riderId) {
    if (action === "add" && !availableRiders.includes(riderId)) { availableRiders.push(riderId); changed = true; }
    else if (action === "remove" && availableRiders.includes(riderId)) { availableRiders.splice(availableRiders.indexOf(riderId), 1); changed = true; }
  }
  if (coachId) {
    if (action === "add" && !availableCoaches.includes(coachId)) { availableCoaches.push(coachId); changed = true; }
    else if (action === "remove" && availableCoaches.includes(coachId)) { availableCoaches.splice(availableCoaches.indexOf(coachId), 1); changed = true; }
  }
  console.log(`[updateAttendance] After: riders=${JSON.stringify(availableRiders)}, coaches=${JSON.stringify(availableCoaches)}, changed=${changed}`);

  // When removing someone, also remove them from group assignments (mirrors frontend toggleCoachAvailability)
  // deno-lint-ignore no-explicit-any
  let groups: any[] = Array.isArray(ride.groups) ? ride.groups.map((g: any) => ({ ...g })) : [];
  let groupsChanged = false;
  if (action === "remove") {
    for (const g of groups) {
      if (riderId && Array.isArray(g.riders)) {
        const before = g.riders.length;
        g.riders = g.riders.filter((id: number) => id !== riderId);
        if (g.riders.length !== before) groupsChanged = true;
      }
      if (coachId && g.coaches) {
        const c = { ...g.coaches };
        if (c.leader === coachId) { c.leader = null; groupsChanged = true; }
        if (c.sweep === coachId) { c.sweep = null; groupsChanged = true; }
        if (c.roam === coachId) { c.roam = null; groupsChanged = true; }
        if (Array.isArray(c.extraRoam)) {
          const before = c.extraRoam.length;
          c.extraRoam = c.extraRoam.filter((id: number) => id !== coachId);
          if (c.extraRoam.length !== before) groupsChanged = true;
        }
        g.coaches = c;
      }
    }
    if (groupsChanged) {
      console.log(`[updateAttendance] Removed person from group assignments`);
    }
  }

  if (changed || groupsChanged) {
    const updatePayload: Record<string, unknown> = {
      available_riders: availableRiders,
      available_coaches: availableCoaches,
    };
    if (groupsChanged) {
      updatePayload.groups = groups;
    }
    const { error } = await supabase.from("rides").update(updatePayload).eq("id", rideId);
    if (error) { console.error("[updateAttendance] DB error:", error); return false; }
    console.log(`[updateAttendance] DB write successful (groupsChanged=${groupsChanged})`);
  } else {
    console.log(`[updateAttendance] No change needed (already in desired state)`);
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

/** Clear (delete) the note for a person on a ride — used when response is updated without a note */
async function clearNote(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  riderId: number | null,
  coachId: number | null
): Promise<void> {
  let query = supabase.from("ride_rider_slack_notes").delete().eq("ride_id", rideId);
  if (riderId) query = query.eq("rider_id", riderId);
  else if (coachId) query = query.eq("coach_id", coachId);
  const { error } = await query;
  if (error) console.error("Error clearing note:", error);
  else console.log(`Note cleared for ${riderId ? "rider " + riderId : "coach " + coachId} on ride ${rideId}`);
}

/** Revert a response to "unknown" — delete the response row, remove from roster, clear notes */
async function handleUnknownResponse(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  slackUserId: string,
  riderId: number | null,
  coachId: number | null
): Promise<void> {
  // Delete the poll response row entirely ("unknown" = no response)
  await supabase
    .from("slack_poll_responses")
    .delete()
    .eq("ride_id", rideId)
    .eq("slack_user_id", slackUserId);

  // Remove from roster
  await updateAttendance(supabase, rideId, riderId, coachId, "remove");

  // Clear coachIfNeeded
  if (coachId && !riderId) {
    await updateCoachIfNeededStatus(supabase, rideId, coachId, false);
  }

  // Clear any notes
  await clearNote(supabase, rideId, riderId, coachId);
}

/** When a rider/coach marks "attending" via Slack poll but has a scheduled absence
 *  covering that practice date, add the date as an exception so TeamRide Pro's
 *  auto-removal doesn't override the Slack attendance response. */
async function addAbsenceExceptionDate(
  supabase: ReturnType<typeof createClient>,
  riderId: number | null,
  coachId: number | null,
  rideDate: string
): Promise<void> {
  // Determine person_type and person_id
  const personType = riderId ? "rider" : coachId ? "coach" : null;
  const personId = riderId ?? coachId;
  if (!personType || !personId) return;

  // Find active scheduled absences covering this date
  const { data: absences, error } = await supabase
    .from("scheduled_absences")
    .select("id, exception_dates, start_date, end_date, specific_practice_days")
    .eq("person_type", personType)
    .eq("person_id", personId)
    .lte("start_date", rideDate)
    .gte("end_date", rideDate);

  if (error) { console.error("[addAbsenceException] query error:", error); return; }
  if (!absences || absences.length === 0) return;

  // Filter for absences that actually apply (check specific_practice_days)
  const rideDow = new Date(rideDate + "T12:00:00").getDay();
  const matching = absences.filter(a => {
    const days = a.specific_practice_days;
    if (Array.isArray(days) && days.length > 0 && !days.includes(rideDow)) return false;
    // Already excepted?
    if (Array.isArray(a.exception_dates) && a.exception_dates.includes(rideDate)) return false;
    return true;
  });

  // Add exception date to each matching absence
  for (const absence of matching) {
    const exceptions = Array.isArray(absence.exception_dates) ? [...absence.exception_dates] : [];
    exceptions.push(rideDate);
    const { error: updateError } = await supabase
      .from("scheduled_absences")
      .update({ exception_dates: exceptions })
      .eq("id", absence.id);
    if (updateError) {
      console.error(`[addAbsenceException] update error for absence ${absence.id}:`, updateError);
    } else {
      console.log(`[addAbsenceException] Added exception ${rideDate} to absence ${absence.id} for ${personType} ${personId}`);
    }
  }
}

/** Update rides.settings.coachIfNeeded for a coach's "if_needed" status */
async function updateCoachIfNeededStatus(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  coachId: number,
  ifNeeded: boolean
): Promise<void> {
  const { data: ride } = await supabase
    .from("rides")
    .select("settings")
    .eq("id", rideId)
    .single();
  const settings = ride?.settings ?? {};
  const coachIfNeeded = settings.coachIfNeeded ?? {};
  if (ifNeeded) {
    coachIfNeeded[coachId] = true;
  } else {
    delete coachIfNeeded[coachId];
  }
  settings.coachIfNeeded = coachIfNeeded;
  await supabase.from("rides").update({ settings }).eq("id", rideId);
  console.log(`coachIfNeeded updated: ride=${rideId}, coach=${coachId}, ifNeeded=${ifNeeded}`);
}

// =============================================================================
// HELPERS — Poll response tracking & live tally
// =============================================================================

/** Upsert a poll response (who answered and their attendance status) */
async function trackPollResponse(
  supabase: ReturnType<typeof createClient>,
  rideId: number,
  slackUserId: string,
  riderId: number | null,
  coachId: number | null,
  attendanceStatus: "attending" | "absent" | "if_needed"
): Promise<void> {
  const row: Record<string, unknown> = {
    ride_id: rideId,
    slack_user_id: slackUserId,
    attendance_status: attendanceStatus,
    responded_at: new Date().toISOString(),
  };
  if (riderId) row.rider_id = riderId;
  if (coachId) row.coach_id = coachId;

  const { error } = await supabase
    .from("slack_poll_responses")
    .upsert(row, { onConflict: "ride_id,slack_user_id" });
  if (error) console.error("Error tracking poll response:", error);
  else console.log(`Poll response tracked: ride=${rideId}, user=${slackUserId}, status=${attendanceStatus}`);
}

/** Count active (non-archived) riders, coaches, or both */
async function getActiveRosterCount(
  supabase: ReturnType<typeof createClient>,
  role?: "rider" | "coach"
): Promise<number> {
  if (role === "rider") {
    const { count } = await supabase.from("riders").select("id", { count: "exact", head: true }).or("archived.is.null,archived.eq.false");
    return count ?? 0;
  }
  if (role === "coach") {
    // Exclude N/A level coaches — they are not eligible to ride
    const { count } = await supabase.from("coaches").select("id", { count: "exact", head: true }).or("archived.is.null,archived.eq.false").not("level", "eq", "N/A");
    return count ?? 0;
  }
  const [{ count: riderCount }, { count: coachCount }] = await Promise.all([
    supabase.from("riders").select("id", { count: "exact", head: true }).or("archived.is.null,archived.eq.false"),
    // Exclude N/A level coaches — they are not eligible to ride
    supabase.from("coaches").select("id", { count: "exact", head: true }).or("archived.is.null,archived.eq.false").not("level", "eq", "N/A"),
  ]);
  return (riderCount ?? 0) + (coachCount ?? 0);
}

/** Determine role for a channel: coach channel → "coach", everything else → "rider" */
function channelRole(channelId: string): "rider" | "coach" {
  return channelId === SLACK_COACH_CHANNEL_ID ? "coach" : "rider";
}

/** Update every posted poll message for this ride with a role-filtered live tally */
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

  // Get ride info to rebuild the message blocks
  const ride = await getRideById(supabase, rideId);
  if (!ride) return;
  const times = await getPracticeTimes(supabase, ride.date);

  // Update each channel's poll with its own role-filtered tally
  for (const poll of polls) {
    const role = channelRole(poll.channel_id);
    const totalRoster = await getActiveRosterCount(supabase, role);

    // Use ride record arrays as source of truth (handles CSV imports + riders without Slack IDs)
    let tally: { attending: number; ifNeeded: number; notAttending: number; noResponse: number };
    if (role === "rider") {
      // Riders default to attending — use available_riders array from ride record
      const availableCount = Array.isArray(ride.available_riders) ? ride.available_riders.length : 0;
      const notAttendingCount = Math.max(0, totalRoster - availableCount);
      tally = { attending: availableCount, ifNeeded: 0, notAttending: notAttendingCount, noResponse: 0 };
    } else {
      // Coaches: available_coaches includes both "attending" and "if_needed"
      // Cross-reference with slack_poll_responses to distinguish if_needed
      const availableCoachesArr: number[] = Array.isArray(ride.available_coaches) ? ride.available_coaches : [];
      const { data: ifNeededResponses } = await supabase
        .from("slack_poll_responses")
        .select("coach_id")
        .eq("ride_id", rideId)
        .eq("attendance_status", "if_needed")
        .not("coach_id", "is", null);
      const ifNeededCoachIds = new Set((ifNeededResponses ?? []).map((r: any) => r.coach_id));
      const ifNeededInAvailable = availableCoachesArr.filter(id => ifNeededCoachIds.has(id)).length;

      const attendingCount = availableCoachesArr.length - ifNeededInAvailable;
      const ifNeededCount = ifNeededInAvailable;
      const notInAvailable = Math.max(0, totalRoster - availableCoachesArr.length);
      // Distinguish "not attending" (explicit absent) from "not yet responded"
      const { data: absentResponses } = await supabase
        .from("slack_poll_responses")
        .select("coach_id")
        .eq("ride_id", rideId)
        .eq("attendance_status", "absent")
        .not("coach_id", "is", null);
      const explicitAbsentCount = absentResponses?.length ?? 0;
      // Coaches not in available_coaches and not explicitly absent = not yet responded
      const notAttendingCount = Math.min(explicitAbsentCount, notInAvailable);
      const noResponseCount = Math.max(0, notInAvailable - notAttendingCount);
      tally = { attending: attendingCount, ifNeeded: ifNeededCount, notAttending: notAttendingCount, noResponse: noResponseCount };
    }

    const updatedPoll = buildPollMessage(rideId, ride.date, times, tally, role === "coach");

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
    else console.log(`Tally updated (${role}): attending=${tally.attending}, ifNeeded=${tally.ifNeeded}, notAttending=${tally.notAttending}, noResponse=${tally.noResponse}`);
  }
}

// =============================================================================
// HELPERS — Slack UI builders
// =============================================================================

/** Future Attendance: Modal with inline dropdowns per upcoming practice.
 *  Uses section blocks with accessory selects for inline layout (label left, dropdown right).
 *  Changes auto-save instantly via block_actions — no submit button needed. */
function buildFutureAttendanceModal(
  rides: Array<{ id: number; date: string }>,
  isCoach: boolean,
  channelId: string,
  existingResponses: Map<number, string>, // rideId -> "attending"|"absent"|"if_needed"
  timesMap: Map<string, { startTime: string | null; endTime: string | null }> // dateStr -> times
) {
  // Build dropdown options (rider vs coach)
  const unknownOption = { text: { type: "plain_text" as const, text: "Unknown" }, value: "unknown" };
  const options: any[] = [
    unknownOption,
    { text: { type: "plain_text" as const, text: "Attending" }, value: "attend" },
    { text: { type: "plain_text" as const, text: "Not Attending" }, value: "absent" },
  ];
  if (isCoach) {
    options.push({ text: { type: "plain_text" as const, text: "If Needed" }, value: "if_needed" });
  }

  // Map DB status to dropdown value
  const statusToValue: Record<string, string> = {
    attending: "attend",
    absent: "absent",
    if_needed: "if_needed",
  };

  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "Mark your attendance for upcoming practices.\nChanges save automatically." },
    },
    { type: "divider" },
  ];

  for (const ride of rides) {
    const friendlyDate = formatDate(ride.date);
    const rideTimes = timesMap.get(ride.date);
    const timeLabel = rideTimes ? formatTimeRangeParens(rideTimes.startTime, rideTimes.endTime) : "";
    const label = timeLabel ? `*${friendlyDate}* (${timeLabel})` : `*${friendlyDate}*`;
    const existing = existingResponses.get(ride.id);
    const existingValue = existing ? statusToValue[existing] : undefined;
    const initialOption = existingValue
      ? options.find((o: any) => o.value === existingValue) || unknownOption
      : unknownOption;

    blocks.push({
      type: "section",
      block_id: `ride_${ride.id}`,
      text: { type: "mrkdwn", text: label },
      accessory: {
        type: "static_select",
        action_id: `future_choice_${ride.id}`,
        options,
        initial_option: initialOption,
      },
    });
  }

  return {
    type: "modal" as const,
    callback_id: "future_attendance",
    private_metadata: JSON.stringify({ isCoach, channelId }),
    title: { type: "plain_text" as const, text: "Future Practices" },
    close: { type: "plain_text" as const, text: "Done" },
    blocks,
  };
}

/** Step 1: Channel message with "Confirm Attendance" button + optional live tally */
function buildPollMessage(
  rideId: number,
  dateStr: string,
  times: { startTime: string | null; endTime: string | null },
  tally?: { attending: number; ifNeeded: number; notAttending: number; noResponse: number },
  isCoachChannel?: boolean
) {
  const friendlyDate = formatDate(dateStr);
  const timeDisplay = formatTimeRange(times.startTime, times.endTime);
  const headline = `Please mark your attendance for practice on *${friendlyDate}*${timeDisplay}`;

  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `:clipboard: ${headline}` },
    },
  ];

  // Rider-only note about missing practices
  if (!isCoachChannel) {
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: "_NOTE: Missing multiple practices due to injury or other circumstances? Please use the button below to send a direct message to the coaches explaining the situation and duration of your absence._",
      }],
    });
  }

  // Action buttons: Update/Respond + DM Head Coaches (riders) or Mark Future Attendance (coaches)
  const actionElements: any[] = [
    {
      type: "button",
      text: { type: "plain_text", text: isCoachChannel ? "Respond for this Practice" : "Update Practice Attendance", emoji: true },
      style: "primary",
      action_id: "confirm_attendance",
      value: `confirm_${rideId}`,
    },
  ];
  if (isCoachChannel) {
    actionElements.push({
      type: "button",
      text: { type: "plain_text", text: "Mark Future Attendance...", emoji: true },
      action_id: "mark_future_practices",
      value: `future_${rideId}`,
    });
  } else {
    actionElements.push({
      type: "button",
      text: { type: "plain_text", text: "DM Head Coaches", emoji: true },
      action_id: "dm_head_coaches",
      value: `dm_coaches_${rideId}`,
    });
  }

  blocks.push({ type: "actions", elements: actionElements });

  // Append live tally if we have response data
  if (tally) {
    // Only show "if needed" segment in coach channel (riders don't have that option)
    const ifNeededSegment = isCoachChannel && tally.ifNeeded > 0
      ? ` · ${tally.ifNeeded} if needed`
      : "";
    // Riders default to attending — no "not yet responded" field
    // Coaches must explicitly respond — show "not yet responded" count
    const noResponseSegment = isCoachChannel && tally.noResponse > 0
      ? ` · ${tally.noResponse} not yet responded`
      : "";
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_${tally.attending} attending${ifNeededSegment} · ${tally.notAttending} not attending${noResponseSegment}_`,
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

/** Step 2: Modal with attend/not-attend radio buttons + conditional reason field
 *  Coaches get a 3rd "Can attend if needed" option and an optional comments field */
function buildAttendanceModal(
  rideId: number,
  dateStr: string,
  times: { startTime: string | null; endTime: string | null },
  showReason: boolean,
  isCoach: boolean = false,
  channelId: string = "",
  existingChoice?: string // "attend" | "absent" | "if_needed" — pre-fills radio from advance response
) {
  const friendlyDate = formatDate(dateStr);
  const timeDisplay = formatTimeRange(times.startTime, times.endTime);

  const radioOptions: any[] = [
    {
      text: { type: "plain_text", text: "I will attend", emoji: true },
      value: "attend",
    },
    {
      text: { type: "plain_text", text: "I will not attend", emoji: true },
      value: "absent",
    },
  ];

  // Coaches get a 3rd option
  if (isCoach) {
    radioOptions.push({
      text: { type: "plain_text", text: "Can attend if needed", emoji: true },
      value: "if_needed",
    });
  }

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
        options: radioOptions,
        ...(existingChoice ? { initial_option: radioOptions.find((o: any) => o.value === existingChoice) } : {}),
      },
      label: { type: "plain_text", text: "Will you attend this practice?" },
    },
  ];

  // Reason field: only shown for RIDERS when "absent" is selected (coaches don't need a reason)
  if (showReason && !isCoach) {
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

  // Coaches always get an optional comments/requests field
  if (isCoach) {
    blocks.push({
      type: "input",
      block_id: "comments_block",
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: "comments_input",
        max_length: 100,
        multiline: false,
        placeholder: { type: "plain_text", text: "e.g., Can only stay until 5pm..." },
      },
      label: { type: "plain_text", text: "Comments/Requests" },
    });
  }

  return {
    type: "modal" as const,
    callback_id: `attendance_${rideId}`,
    // Store isCoach + channelId in metadata so handlers can rebuild and post ephemeral
    private_metadata: JSON.stringify({ rideId, dateStr, times, isCoach, channelId }),
    title: { type: "plain_text" as const, text: "Practice Attendance" },
    submit: { type: "plain_text" as const, text: "Submit" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks,
  };
}

/** Step 3: Ephemeral confirmation blocks with timestamp and Change Response button */
function buildConfirmationBlocks(
  rideId: number,
  dateStr: string,
  attendanceStatus: "attending" | "absent" | "if_needed",
  isUpdate: boolean,
  reason?: string,
  comments?: string
) {
  const friendlyDate = formatDate(dateStr);
  const timestamp = formatNowTimestamp();
  const header = isUpdate ? "UPDATED Response" : "Response recorded";
  let emoji: string;
  let status: string;
  switch (attendanceStatus) {
    case "attending":
      emoji = ":white_check_mark:";
      status = "Attending";
      break;
    case "if_needed":
      emoji = ":raised_hand:";
      status = "Can attend if needed";
      break;
    case "absent":
      emoji = ":x:";
      status = "Not attending";
      break;
  }

  let text = `${emoji} *${header} (${timestamp})*\n*Practice:* ${friendlyDate}\n*Status:* ${status}`;
  if (attendanceStatus === "absent" && reason) {
    text += `\n*Reason:* ${reason}`;
  }
  if (comments) {
    text += `\n*Comments:* ${comments}`;
  }

  return {
    response_type: "ephemeral",
    replace_original: false,
    text: `${header}: ${status} for ${friendlyDate}`,
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
            text: { type: "plain_text", text: "Change Response", emoji: true },
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
  const times = await getPracticeTimes(supabase, dateStr);
  const role = channelRole(channelId);
  const roleColumn = role === "coach" ? "coach_id" : "rider_id";
  const personType = role === "coach" ? "coach" : "rider";

  // --- Step 1: Collect scheduled absence person IDs (regardless of Slack ID) ---
  const absentPersonIds = new Set<number>();
  try {
    const { data: absences } = await supabase
      .from("scheduled_absences")
      .select("id, person_id, person_type, specific_practice_days, exception_dates")
      .eq("person_type", personType)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    if (absences && absences.length > 0) {
      const rideDow = new Date(dateStr + "T12:00:00").getDay();
      for (const a of absences) {
        const days = a.specific_practice_days;
        if (Array.isArray(days) && days.length > 0 && !days.includes(rideDow)) continue;
        if (Array.isArray(a.exception_dates) && a.exception_dates.includes(dateStr)) continue;
        absentPersonIds.add(a.person_id);
      }
      if (absentPersonIds.size > 0) {
        console.log(`[postPoll] Found ${absentPersonIds.size} ${personType}(s) with scheduled absences for ride ${rideId}`);
      }
    }
  } catch (e) {
    console.error("[postPoll] Error collecting scheduled absences:", e);
  }

  // --- Step 2: Build Slack ID lookup + existing responses (single batch for both blocks) ---
  let personSlackMap = new Map<number, string>();
  let alreadyRespondedPersonIds = new Set<number>();
  try {
    const [{ data: pastResponses }, { data: existingForRide }] = await Promise.all([
      supabase.from("slack_poll_responses").select(`${roleColumn}, slack_user_id`).not(roleColumn, "is", null),
      supabase.from("slack_poll_responses").select(`${roleColumn}`).eq("ride_id", rideId).not(roleColumn, "is", null),
    ]);
    for (const r of pastResponses ?? []) {
      const pid = role === "coach" ? r.coach_id : r.rider_id;
      if (pid) personSlackMap.set(pid, r.slack_user_id);
    }
    for (const r of existingForRide ?? []) {
      const pid = role === "coach" ? r.coach_id : r.rider_id;
      if (pid) alreadyRespondedPersonIds.add(pid);
    }
  } catch (e) {
    console.error("[postPoll] Error fetching Slack lookups:", e);
  }

  // --- Step 3: Pre-populate absence poll responses (for those with Slack IDs, coaches always) ---
  // For coaches: also call updateAttendance(remove) since coaches aren't auto-added
  try {
    let absencePrePop = 0;
    for (const personId of absentPersonIds) {
      if (alreadyRespondedPersonIds.has(personId)) continue; // don't override existing responses
      const riderId = personType === "rider" ? personId : null;
      const coachId = personType === "coach" ? personId : null;
      // Coaches: need updateAttendance(remove) since they might be in available_coaches from CSV
      if (coachId) {
        await updateAttendance(supabase, rideId, null, coachId, "remove");
      }
      // Track poll response if Slack ID is known
      const slackUserId = personSlackMap.get(personId);
      if (slackUserId) {
        await trackPollResponse(supabase, rideId, slackUserId, riderId, coachId, "absent");
      }
      absencePrePop++;
    }
    if (absencePrePop > 0) {
      console.log(`[postPoll] Pre-populated ${absencePrePop} ${personType} absence(s) for ride ${rideId}`);
    }
  } catch (e) {
    console.error("[postPoll] Error pre-populating absences:", e);
  }

  // --- Step 4: Pre-populate ALL riders as "attending" by default (coaches are not defaulted) ---
  // Adds ALL active riders to available_riders in a SINGLE batch DB write (not one per rider).
  // Only creates slack_poll_responses entries for riders with known Slack IDs.
  const defaultAttendingSlackIds: string[] = [];
  if (role === "rider") {
    try {
      const { data: activeRiders } = await supabase.from("riders").select("id").or("archived.is.null,archived.eq.false");

      // Build the complete list of rider IDs to add in one pass
      const riderIdsToAdd: number[] = [];
      for (const rider of activeRiders ?? []) {
        if (absentPersonIds.has(rider.id)) continue; // scheduled absence — stay absent
        if (alreadyRespondedPersonIds.has(rider.id)) continue; // already has a response (future marking, etc.)
        riderIdsToAdd.push(rider.id);
      }

      if (riderIdsToAdd.length > 0) {
        // Single batch write: read ride once, add all riders, write once
        const rideForBatch = await getRideById(supabase, rideId);
        if (rideForBatch) {
          const currentRiders: number[] = Array.isArray(rideForBatch.available_riders) ? [...rideForBatch.available_riders] : [];
          const existingSet = new Set(currentRiders);
          for (const id of riderIdsToAdd) {
            if (!existingSet.has(id)) { currentRiders.push(id); existingSet.add(id); }
          }
          const { error } = await supabase.from("rides").update({ available_riders: currentRiders }).eq("id", rideId);
          if (error) console.error("[postPoll] Batch rider update error:", error);
          else console.log(`[postPoll] Default-attending: batch-added ${riderIdsToAdd.length} rider(s) to available_riders for ride ${rideId}`);
        }

        // Track poll responses for riders with known Slack IDs (can run in parallel)
        const pollPromises: Promise<void>[] = [];
        for (const riderId of riderIdsToAdd) {
          const slackUserId = personSlackMap.get(riderId);
          if (slackUserId) {
            pollPromises.push(trackPollResponse(supabase, rideId, slackUserId, riderId, null, "attending"));
            defaultAttendingSlackIds.push(slackUserId);
          }
        }
        if (pollPromises.length > 0) {
          await Promise.all(pollPromises);
          console.log(`[postPoll] Tracked ${pollPromises.length} poll response(s) for default-attending riders`);
        }
      }
    } catch (e) {
      console.error("[postPoll] Error pre-populating default rider attendance:", e);
    }
  }

  // Build initial tally from ride record arrays (source of truth, handles all pre-population paths)
  const totalRoster = await getActiveRosterCount(supabase, role);
  const rideAfterPrePop = await getRideById(supabase, rideId);
  let tally: { attending: number; ifNeeded: number; notAttending: number; noResponse: number } | undefined;
  if (role === "rider") {
    // Riders: use available_riders count — all defaults + absences already applied above
    const availableCount = Array.isArray(rideAfterPrePop?.available_riders) ? rideAfterPrePop.available_riders.length : 0;
    const notAttendingCount = Math.max(0, totalRoster - availableCount);
    tally = { attending: availableCount, ifNeeded: 0, notAttending: notAttendingCount, noResponse: 0 };
  } else {
    // Coaches: use available_coaches + cross-reference if_needed from poll responses
    const availableCoachesArr: number[] = Array.isArray(rideAfterPrePop?.available_coaches) ? rideAfterPrePop.available_coaches : [];
    if (availableCoachesArr.length > 0 || absentPersonIds.size > 0) {
      const { data: ifNeededResponses } = await supabase
        .from("slack_poll_responses")
        .select("coach_id")
        .eq("ride_id", rideId)
        .eq("attendance_status", "if_needed")
        .not("coach_id", "is", null);
      const ifNeededCoachIds = new Set((ifNeededResponses ?? []).map((r: any) => r.coach_id));
      const ifNeededInAvailable = availableCoachesArr.filter(id => ifNeededCoachIds.has(id)).length;

      const attendingCount = availableCoachesArr.length - ifNeededInAvailable;
      const ifNeededCount = ifNeededInAvailable;
      const notInAvailable = Math.max(0, totalRoster - availableCoachesArr.length);
      // Count explicit absences (from poll responses or scheduled absences)
      const { data: absentResponses } = await supabase
        .from("slack_poll_responses")
        .select("coach_id")
        .eq("ride_id", rideId)
        .eq("attendance_status", "absent")
        .not("coach_id", "is", null);
      const explicitAbsentCount = Math.max(absentResponses?.length ?? 0, absentPersonIds.size);
      const notAttendingCount = Math.min(explicitAbsentCount, notInAvailable);
      const noResponseCount = Math.max(0, notInAvailable - notAttendingCount);
      tally = { attending: attendingCount, ifNeeded: ifNeededCount, notAttending: notAttendingCount, noResponse: noResponseCount };
    }
  }

  const isCoachChannel = role === "coach";
  const poll = buildPollMessage(rideId, dateStr, times, tally, isCoachChannel);
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

  // --- Send ephemeral confirmations to people with pre-populated responses ---
  // Riders: default-attending (collected above). Coaches: any pre-response (future marking, CSV import, absences).
  const ephTargets: Array<{ slackId: string; status: string; source: string }> = [];

  // Rider default-attending ephemerals
  for (const slackId of defaultAttendingSlackIds) {
    ephTargets.push({ slackId, status: "attending", source: "default" });
  }

  // Coach pre-response ephemerals — query all pre-populated responses for this ride
  // Exclude N/A level coaches who are not eligible to ride
  if (role === "coach") {
    try {
      const { data: coachPreResponses } = await supabase
        .from("slack_poll_responses")
        .select("slack_user_id, attendance_status, coach_id")
        .eq("ride_id", rideId)
        .not("coach_id", "is", null);
      // Filter out N/A coaches
      const naCoachIds = new Set<number>();
      if (coachPreResponses && coachPreResponses.length > 0) {
        const coachIds = [...new Set(coachPreResponses.map((r: any) => r.coach_id).filter(Boolean))];
        if (coachIds.length > 0) {
          const { data: naCoaches } = await supabase
            .from("coaches")
            .select("id")
            .in("id", coachIds)
            .eq("level", "N/A");
          for (const c of naCoaches ?? []) naCoachIds.add(c.id);
        }
      }
      for (const r of coachPreResponses ?? []) {
        if (!naCoachIds.has(r.coach_id)) {
          ephTargets.push({ slackId: r.slack_user_id, status: r.attendance_status, source: "pre-set" });
        }
      }
    } catch (e) {
      console.error("[postPoll] Error fetching coach pre-responses for ephemerals:", e);
    }
  }

  if (ephTargets.length > 0) {
    // Small delay so Slack renders the poll message first — ephemerals then appear below it
    await new Promise(resolve => setTimeout(resolve, 2000));

    const friendlyDate = formatDate(dateStr);
    const statusDisplay = (status: string, source: string) => {
      switch (status) {
        case "attending":
          return {
            emoji: ":white_check_mark:",
            label: source === "default" ? "Attending (default)" : "Attending",
            note: source === "default"
              ? "All riders are marked attending by default. If you can't make it, please change your response below."
              : "This was pre-set from your earlier response. You can change it below if needed.",
          };
        case "absent":
          return {
            emoji: ":x:",
            label: "Not attending",
            note: "This was pre-set from your earlier response or a scheduled absence. You can change it below if needed.",
          };
        case "if_needed":
          return {
            emoji: ":raised_hand:",
            label: "Can attend if needed",
            note: "This was pre-set from your earlier response. You can change it below if needed.",
          };
        default:
          return { emoji: ":grey_question:", label: status, note: "You can change your response below." };
      }
    };

    // Fire-and-forget — don't block poll posting on ephemeral delivery
    for (const target of ephTargets) {
      const display = statusDisplay(target.status, target.source);
      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${display.emoji} *Your status: ${display.label}*\n*Practice:* ${friendlyDate}\n${display.note}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Change Response", emoji: true },
              action_id: "update_response",
              value: `update_${rideId}`,
            },
          ],
        },
      ];
      fetch("https://slack.com/api/chat.postEphemeral", {
        method: "POST",
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelId,
          user: target.slackId,
          text: `Your status for ${friendlyDate}: ${display.label}. Change your response if needed.`,
          blocks,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!d.ok) console.error(`Ephemeral to ${target.slackId} failed:`, d.error);
      }).catch((e) => console.error(`Ephemeral to ${target.slackId} error:`, e));
    }
    console.log(`[postPoll] Sent ${ephTargets.length} ephemeral confirmation(s) for ride ${rideId} (${role} channel)`);
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
    // Smart timing: only sends when current Pacific hour matches the calculated
    // reminder time (N notification-hours before practice, within 9 AM – 8 PM window).
    // Called hourly by GitHub Actions cron; self-gates to avoid wrong-hour sends.
    if (body.action === "send_reminders") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const ride = await getNextRide(supabase);
      if (!ride) return jsonResponse({ skipped: true, reason: "No upcoming practice found" });

      // Skip reminders if groups have already been published (planning is done)
      if (ride.published_groups === true) {
        return jsonResponse({ skipped: true, reason: "Groups already published — reminders not needed", rideId: ride.id, date: ride.date });
      }

      // Load configurable lead time from season_settings (default: 4 hours)
      const { data: settingsRow } = await supabase
        .from("season_settings")
        .select("reminder_lead_hours")
        .eq("id", "current")
        .single();
      const leadHours: number = (settingsRow as any)?.reminder_lead_hours ?? 4;

      // Get practice start time for the next ride
      const practiceTimes = await getPracticeTimes(supabase, ride.date);

      // Calculate ideal reminder time in Pacific
      const idealTime = calculateReminderTime(ride.date, practiceTimes.startTime, leadHours);
      const now = getCurrentPacificTime();

      console.log(`[send_reminders] ride=${ride.id} date=${ride.date} practiceStart=${practiceTimes.startTime} leadHours=${leadHours}`);
      console.log(`[send_reminders] idealTime=${idealTime.date} ${idealTime.hour}:${String(idealTime.minute).padStart(2,"0")} | now=${now.date} ${now.hour}:${String(now.minute).padStart(2,"0")}`);

      // Gate check: only send if current Pacific date+hour matches the calculated reminder date+hour
      // For manual workflow_dispatch, bypass the timing gate (allow immediate send)
      const isManualTrigger = !!body.force;
      if (!isManualTrigger && (now.date !== idealTime.date || now.hour !== idealTime.hour)) {
        return jsonResponse({
          skipped: true,
          reason: "Not reminder time",
          nextRide: { id: ride.id, date: ride.date, practiceStart: practiceTimes.startTime },
          idealReminderTime: `${idealTime.date} ${idealTime.hour}:${String(idealTime.minute).padStart(2, "0")} Pacific`,
          currentTime: `${now.date} ${now.hour}:${String(now.minute).padStart(2, "0")} Pacific`,
        });
      }

      // Duplicate check: read ride settings to see if reminders already sent
      const { data: rideRow } = await supabase
        .from("rides")
        .select("settings")
        .eq("id", ride.id)
        .single();
      const rideSettings = (rideRow as any)?.settings ?? {};
      if (rideSettings.slackReminderSentAt && !isManualTrigger) {
        return jsonResponse({
          skipped: true,
          reason: "Reminders already sent for this ride",
          rideId: ride.id,
          sentAt: rideSettings.slackReminderSentAt,
        });
      }

      // Get responses for this ride, separated by role
      const { data: responses } = await supabase
        .from("slack_poll_responses")
        .select("rider_id, coach_id")
        .eq("ride_id", ride.id);
      const respondedRiderIds = new Set<number>();
      const respondedCoachIds = new Set<number>();
      for (const r of responses ?? []) {
        if (r.rider_id) respondedRiderIds.add(r.rider_id);
        if (r.coach_id) respondedCoachIds.add(r.coach_id);
      }

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

      // Get active roster (coaches include opt-out flag)
      const [{ data: riders }, { data: coaches }] = await Promise.all([
        supabase.from("riders").select("id").or("archived.is.null,archived.eq.false"),
        supabase.from("coaches").select("id, slack_reminders_disabled").or("archived.is.null,archived.eq.false"),
      ]);

      // Find non-responders who have a known Slack user ID (by role)
      // Track coach Slack IDs separately so we can add the mute button to their DMs
      const riderTargets: string[] = [];
      const coachTargets: string[] = [];
      let skippedOptedOut = 0;
      for (const rider of riders ?? []) {
        if (!respondedRiderIds.has(rider.id)) {
          const slackId = riderSlackMap.get(rider.id);
          if (slackId) riderTargets.push(slackId);
        }
      }
      for (const coach of coaches ?? []) {
        if (!respondedCoachIds.has(coach.id)) {
          if ((coach as any).slack_reminders_disabled === true) { skippedOptedOut++; continue; }
          const slackId = coachSlackMap.get(coach.id);
          if (slackId) coachTargets.push(slackId);
        }
      }
      const coachSlackIds = new Set(coachTargets);

      if (riderTargets.length === 0 && coachTargets.length === 0) {
        return jsonResponse({ success: true, reminders_sent: 0, skippedOptedOut, reason: "Everyone has responded (or no Slack IDs on file)" });
      }

      // Send DM reminders
      const allTargets = [...riderTargets, ...coachTargets];
      const friendlyDate = formatDate(ride.date);
      const timeDisplay = formatTimeRange(practiceTimes.startTime, practiceTimes.endTime);
      let sent = 0;

      for (const userId of allTargets) {
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

          // Build action buttons — coaches get an extra "Mute reminders" option
          const actionElements: any[] = [{
            type: "button",
            text: { type: "plain_text", text: "Respond for this Practice", emoji: true },
            style: "primary",
            action_id: "confirm_attendance",
            value: `confirm_${ride.id}`,
          }];
          if (coachSlackIds.has(userId)) {
            actionElements.push({
              type: "button",
              text: { type: "plain_text", text: "Mute future reminders", emoji: true },
              action_id: "opt_out_reminders",
              value: "opt_out",
            });
          }

          // Send a reminder with the Confirm Attendance button (+ mute for coaches)
          const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: dmChannelId,
              text: `Reminder: Please mark your attendance for practice on ${friendlyDate}`,
              blocks: [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: `:wave: Reminder: Please mark your attendance for practice on *${friendlyDate}*${timeDisplay}` },
                },
                {
                  type: "actions",
                  elements: actionElements,
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

      // Mark reminders as sent in ride settings to prevent duplicate sends
      try {
        const updatedSettings = { ...rideSettings, slackReminderSentAt: new Date().toISOString() };
        await supabase.from("rides").update({ settings: updatedSettings }).eq("id", ride.id);
      } catch (e) {
        console.error("[send_reminders] Error saving reminder-sent flag:", e);
      }

      return jsonResponse({
        success: true,
        rideId: ride.id,
        reminders_sent: sent,
        non_responders: reminderTargets.length,
        reminderTime: `${idealTime.date} ${idealTime.hour}:${String(idealTime.minute).padStart(2, "0")} Pacific`,
      });
    }

    // --- cleanup_duplicate_rides: find and soft-delete duplicate ride rows per date ---
    if (body.action === "cleanup_duplicate_rides") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const today = new Date().toISOString().slice(0, 10);

      // Fetch all future, non-deleted, non-cancelled rides (handle null values)
      const { data: rides, error } = await supabase
        .from("rides")
        .select("id, date, created_at")
        .or("cancelled.is.null,cancelled.eq.false")
        .or("deleted.is.null,deleted.eq.false")
        .gte("date", today)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) return jsonResponse({ success: false, error: error.message }, 500);
      if (!rides || rides.length === 0) return jsonResponse({ success: true, duplicatesRemoved: 0 });

      // Group by date — keep the first (oldest) ride per date, mark the rest as deleted
      const dateMap = new Map<string, number[]>();
      for (const ride of rides) {
        const ids = dateMap.get(ride.date) || [];
        ids.push(ride.id);
        dateMap.set(ride.date, ids);
      }

      let duplicatesRemoved = 0;
      const details: Array<{ date: string; kept: number; removed: number[] }> = [];
      for (const [date, ids] of dateMap) {
        if (ids.length <= 1) continue;
        const [keep, ...remove] = ids;
        for (const removeId of remove) {
          const { error: delErr } = await supabase
            .from("rides")
            .update({ deleted: true })
            .eq("id", removeId);
          if (delErr) {
            console.error(`[cleanup] Failed to soft-delete ride ${removeId}:`, delErr);
          } else {
            duplicatesRemoved++;
          }
        }
        details.push({ date, kept: keep, removed: remove });
      }

      console.log(`[cleanup] Removed ${duplicatesRemoved} duplicate ride(s) across ${details.length} date(s)`);
      return jsonResponse({ success: true, duplicatesRemoved, details });
    }

    // --- import_coach_availability: one-time import from practice availability spreadsheet ---
    if (body.action === "import_coach_availability") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Parsed CSV data: coaches with future availability (Y=Yes, N=No, M=Maybe→unknown)
      const AVAIL_DATA: Array<{ name: string; availability: Record<string, "Y" | "N" | "M"> }> = [
        { name: "Adam Phillips", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "Y", "2026-04-08": "Y", "2026-04-15": "Y", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "Y", "2026-04-29": "Y", "2026-05-06": "Y", "2026-05-10": "Y", "2026-05-13": "Y" } },
        { name: "Beverly Seabreeze", availability: { "2026-03-11": "N", "2026-03-15": "N", "2026-03-18": "N", "2026-03-25": "N", "2026-03-29": "N", "2026-04-01": "N" } },
        { name: "Bill Dauphinais", availability: { "2026-03-11": "Y", "2026-03-15": "Y" } },
        { name: "Chuck Moore", availability: { "2026-03-11": "Y" } },
        { name: "Christian Hackett", availability: { "2026-03-11": "N", "2026-03-15": "M", "2026-03-18": "N", "2026-03-25": "N", "2026-03-29": "M", "2026-04-01": "N" } },
        { name: "Cory Creath", availability: { "2026-03-11": "N" } },
        { name: "Dale Kunkel", availability: { "2026-03-11": "N", "2026-03-15": "Y", "2026-03-18": "M", "2026-03-25": "N", "2026-03-29": "Y", "2026-04-01": "N", "2026-04-05": "Y", "2026-04-08": "N", "2026-04-15": "N", "2026-04-19": "Y", "2026-04-22": "N", "2026-04-26": "Y", "2026-04-29": "N", "2026-05-06": "Y", "2026-05-10": "Y" } },
        { name: "Daniel Ciccarone", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "Y", "2026-04-08": "Y", "2026-04-15": "N", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "M", "2026-04-29": "M", "2026-05-06": "Y", "2026-05-10": "Y", "2026-05-13": "Y" } },
        { name: "Daniel Robinson", availability: { "2026-03-11": "N", "2026-03-15": "Y", "2026-03-18": "N", "2026-03-25": "N", "2026-03-29": "Y", "2026-04-01": "N", "2026-04-05": "Y", "2026-04-08": "N", "2026-04-15": "N", "2026-04-19": "Y", "2026-04-22": "N", "2026-04-26": "Y", "2026-04-29": "N", "2026-05-06": "N", "2026-05-10": "Y", "2026-05-13": "N" } },
        { name: "David Collman", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "Y", "2026-04-08": "N", "2026-04-15": "Y", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "Y", "2026-04-29": "Y", "2026-05-06": "Y", "2026-05-10": "Y", "2026-05-13": "Y" } },
        { name: "Eric Eberhardt", availability: { "2026-03-11": "N", "2026-03-15": "N", "2026-03-18": "N", "2026-03-25": "N", "2026-03-29": "Y", "2026-04-01": "N", "2026-04-05": "N", "2026-04-08": "N", "2026-04-15": "N", "2026-04-19": "Y", "2026-04-22": "N", "2026-04-26": "Y", "2026-04-29": "N", "2026-05-06": "N", "2026-05-10": "Y", "2026-05-13": "N" } },
        { name: "James Powell", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "Y", "2026-04-08": "Y", "2026-04-15": "Y", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "Y", "2026-04-29": "Y", "2026-05-06": "Y", "2026-05-10": "Y", "2026-05-13": "Y" } },
        { name: "Marcus Gaetani", availability: { "2026-03-11": "Y", "2026-03-15": "N", "2026-03-18": "N", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y" } },
        { name: "MATTHEW MOSELEY", availability: { "2026-03-11": "M", "2026-03-15": "M", "2026-03-18": "M", "2026-03-25": "M", "2026-03-29": "M", "2026-04-01": "M", "2026-04-05": "M", "2026-04-08": "M", "2026-04-15": "M", "2026-04-19": "M", "2026-04-22": "M", "2026-04-26": "M", "2026-04-29": "M", "2026-05-06": "M", "2026-05-10": "M", "2026-05-13": "M" } },
        { name: "Mike Van Allen", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "N", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "N", "2026-04-08": "M", "2026-04-15": "M", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "Y", "2026-04-29": "Y" } },
        { name: "Sami Mahrus", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "Y", "2026-04-08": "Y", "2026-04-15": "Y", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "Y", "2026-04-29": "Y", "2026-05-06": "Y", "2026-05-10": "Y", "2026-05-13": "Y" } },
        { name: "Scott Martin", availability: { "2026-03-11": "Y", "2026-03-15": "Y", "2026-03-18": "Y", "2026-03-25": "Y", "2026-03-29": "Y", "2026-04-01": "Y", "2026-04-05": "Y", "2026-04-08": "N", "2026-04-15": "Y", "2026-04-19": "Y", "2026-04-22": "Y", "2026-04-26": "Y", "2026-04-29": "Y", "2026-05-06": "Y", "2026-05-10": "Y", "2026-05-13": "Y" } },
      ];

      // Fetch all coaches and rides for the date range
      const allDates = new Set<string>();
      for (const entry of AVAIL_DATA) {
        for (const d of Object.keys(entry.availability)) allDates.add(d);
      }
      const [{ data: coaches }, { data: rides }, { data: pastResponses }] = await Promise.all([
        supabase.from("coaches").select("id, name").or("archived.is.null,archived.eq.false"),
        supabase.from("rides").select("id, date").in("date", [...allDates])
          .or("cancelled.is.null,cancelled.eq.false")
          .or("deleted.is.null,deleted.eq.false"),
        supabase.from("slack_poll_responses").select("coach_id, slack_user_id").not("coach_id", "is", null),
      ]);

      // Build lookup maps — first ride per date wins (matches cleanup which keeps the oldest)
      const rideByDate = new Map<string, number>();
      for (const r of rides ?? []) {
        if (!rideByDate.has(r.date)) rideByDate.set(r.date, r.id);
      }
      const coachSlackMap = new Map<number, string>();
      for (const r of pastResponses ?? []) {
        if (r.coach_id) coachSlackMap.set(r.coach_id, r.slack_user_id);
      }

      // Nickname → canonical name map (bidirectional lookup)
      const NICKNAME_MAP: Record<string, string[]> = {
        "chuck": ["charles"],
        "charles": ["chuck"],
        "bill": ["william"],
        "william": ["bill"],
        "mike": ["michael"],
        "michael": ["mike"],
        "matt": ["matthew"],
        "matthew": ["matt"],
        "dan": ["daniel"],
        "daniel": ["dan"],
        "dave": ["david"],
        "david": ["dave"],
        "jim": ["james"],
        "james": ["jim", "jamie"],
        "bob": ["robert"],
        "robert": ["bob", "rob"],
        "rob": ["robert"],
        "tom": ["thomas"],
        "thomas": ["tom"],
        "joe": ["joseph"],
        "joseph": ["joe"],
        "rick": ["richard"],
        "richard": ["rick", "dick"],
        "dick": ["richard"],
        "steve": ["stephen", "steven"],
        "stephen": ["steve"],
        "steven": ["steve"],
        "ed": ["edward", "edwin"],
        "edward": ["ed"],
        "ted": ["theodore", "edward"],
        "theodore": ["ted"],
        "nick": ["nicholas"],
        "nicholas": ["nick"],
        "tony": ["anthony"],
        "anthony": ["tony"],
        "chris": ["christopher", "christian"],
        "christopher": ["chris"],
        "don": ["donald"],
        "donald": ["don"],
        "doug": ["douglas"],
        "douglas": ["doug"],
        "jeff": ["jeffrey", "geoffrey"],
        "jeffrey": ["jeff"],
        "sam": ["samuel", "samantha"],
        "samuel": ["sam"],
        "samantha": ["sam"],
        "ben": ["benjamin"],
        "benjamin": ["ben"],
        "al": ["albert", "alan", "alexander"],
        "alex": ["alexander", "alexandra"],
        "alexander": ["alex", "al"],
        "andy": ["andrew"],
        "andrew": ["andy"],
        "pat": ["patrick", "patricia"],
        "patrick": ["pat"],
        "jon": ["jonathan"],
        "jonathan": ["jon"],
        "jen": ["jennifer"],
        "jennifer": ["jen"],
        "bev": ["beverly"],
        "beverly": ["bev"],
      };

      function findCoachByName(coachList: Array<{ id: number; name: string }>, csvName: string): { id: number; name: string } | undefined {
        const csvLower = csvName.toLowerCase().trim();
        // 1. Exact case-insensitive match
        const exact = coachList.find(c => c.name.toLowerCase().trim() === csvLower);
        if (exact) return exact;

        // 2. Try nickname variants: swap CSV first name for each alias, check against DB
        const spaceIdx = csvLower.indexOf(" ");
        if (spaceIdx === -1) return undefined;
        const csvFirst = csvLower.slice(0, spaceIdx);
        const csvLast = csvLower.slice(spaceIdx + 1);

        const aliases = NICKNAME_MAP[csvFirst];
        if (aliases) {
          for (const alias of aliases) {
            const candidate = alias + " " + csvLast;
            const match = coachList.find(c => c.name.toLowerCase().trim() === candidate);
            if (match) return match;
          }
        }

        // 3. Reverse: for each DB coach, swap their first name for aliases and check against CSV
        for (const c of coachList) {
          const dbLower = c.name.toLowerCase().trim();
          const dbSpaceIdx = dbLower.indexOf(" ");
          if (dbSpaceIdx === -1) continue;
          const dbFirst = dbLower.slice(0, dbSpaceIdx);
          const dbLast = dbLower.slice(dbSpaceIdx + 1);
          if (dbLast !== csvLast) continue; // last names must match
          const dbAliases = NICKNAME_MAP[dbFirst];
          if (dbAliases && dbAliases.includes(csvFirst)) return c;
        }

        return undefined;
      }

      let matchedCoaches = 0, processedEntries = 0, skippedNoRide = 0, skippedNoCoach = 0, skippedMaybe = 0;
      const unmatchedNames: string[] = [];

      for (const entry of AVAIL_DATA) {
        // Name match with nickname fallback
        const coach = coaches ? findCoachByName(coaches, entry.name) : undefined;
        if (!coach) { skippedNoCoach++; unmatchedNames.push(entry.name); continue; }
        matchedCoaches++;
        const slackUserId = coachSlackMap.get(coach.id);

        for (const [dateStr, status] of Object.entries(entry.availability)) {
          const rideId = rideByDate.get(dateStr);
          if (!rideId) { skippedNoRide++; continue; }

          if (status === "Y") {
            await updateAttendance(supabase, rideId, null, coach.id, "add");
            if (slackUserId) {
              await trackPollResponse(supabase, rideId, slackUserId, null, coach.id, "attending");
            }
            processedEntries++;
          } else if (status === "N") {
            await updateAttendance(supabase, rideId, null, coach.id, "remove");
            if (slackUserId) {
              await trackPollResponse(supabase, rideId, slackUserId, null, coach.id, "absent");
            }
            processedEntries++;
          } else {
            // "M" (Maybe) → unknown — skip (don't create a response)
            skippedMaybe++;
          }
        }
      }

      return jsonResponse({
        success: true,
        matchedCoaches,
        processedEntries,
        skippedNoCoach,
        skippedNoRide,
        skippedMaybe,
        unmatchedNames,
      });
    }

    // --- run_migrations: apply pending SQL migrations using direct Postgres connection ---
    if (body.action === "run_migrations") {
      // Each migration: { name, sql, check } — check is a query that returns rows if already applied
      const MIGRATIONS: Array<{ name: string; sql: string; check: string }> = [
        {
          name: "ADD_REMINDER_LEAD_HOURS",
          sql: `ALTER TABLE season_settings ADD COLUMN IF NOT EXISTS reminder_lead_hours INTEGER DEFAULT 4;
                COMMENT ON COLUMN season_settings.reminder_lead_hours IS 'How many notification-window hours (9 AM - 8 PM) before practice to send DM reminders. Default 4.';`,
          check: `SELECT column_name FROM information_schema.columns WHERE table_name = 'season_settings' AND column_name = 'reminder_lead_hours'`,
        },
        {
          name: "ADD_COACH_REMINDER_OPT_OUT",
          sql: `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS slack_reminders_disabled BOOLEAN DEFAULT FALSE;
                COMMENT ON COLUMN coaches.slack_reminders_disabled IS 'If true, coach will not receive automated DM reminders for attendance polls.';`,
          check: `SELECT column_name FROM information_schema.columns WHERE table_name = 'coaches' AND column_name = 'slack_reminders_disabled'`,
        },
        {
          name: "ADD_SLACK_POLL_TRACKING",
          sql: `CREATE TABLE IF NOT EXISTS slack_attendance_polls (
                  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                  ride_id BIGINT NOT NULL REFERENCES rides(id),
                  channel_id TEXT NOT NULL,
                  message_ts TEXT NOT NULL,
                  role TEXT NOT NULL DEFAULT 'rider',
                  created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS slack_poll_responses (
                  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                  ride_id BIGINT NOT NULL REFERENCES rides(id),
                  slack_user_id TEXT NOT NULL,
                  rider_id BIGINT REFERENCES riders(id),
                  coach_id BIGINT REFERENCES coaches(id),
                  attendance_status TEXT NOT NULL DEFAULT 'attending',
                  responded_at TIMESTAMPTZ DEFAULT NOW(),
                  UNIQUE(ride_id, slack_user_id)
                );`,
          check: `SELECT table_name FROM information_schema.tables WHERE table_name = 'slack_poll_responses'`,
        },
        {
          name: "ADD_RIDE_RIDER_SLACK_NOTES",
          sql: `ALTER TABLE rides ADD COLUMN IF NOT EXISTS rider_slack_notes JSONB DEFAULT '{}'::jsonb;
                COMMENT ON COLUMN rides.rider_slack_notes IS 'Per-rider notes from Slack attendance (keyed by slack_user_id).';`,
          check: `SELECT column_name FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'rider_slack_notes'`,
        },
        {
          name: "ENABLE_REALTIME_FOR_ATTENDANCE",
          sql: `ALTER PUBLICATION supabase_realtime ADD TABLE rides;
                ALTER PUBLICATION supabase_realtime ADD TABLE slack_poll_responses;`,
          check: `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'slack_poll_responses'`,
        },
        {
          name: "RLS_SLACK_POLL_RESPONSES_SELECT",
          sql: `ALTER TABLE slack_poll_responses ENABLE ROW LEVEL SECURITY;
                CREATE POLICY "Allow authenticated read on slack_poll_responses" ON slack_poll_responses FOR SELECT TO authenticated USING (true);`,
          check: `SELECT policyname FROM pg_policies WHERE tablename = 'slack_poll_responses' AND policyname = 'Allow authenticated read on slack_poll_responses'`,
        },
      ];

      // Connect to Postgres directly (SUPABASE_DB_URL is auto-injected in edge functions)
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (!dbUrl) {
        return jsonResponse({ success: false, error: "SUPABASE_DB_URL not available" }, 500);
      }

      const results: Array<{ name: string; status: string }> = [];
      try {
        // Dynamic import to avoid bundling issues if module isn't needed
        const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
        const pool = new Pool(dbUrl, 1);
        const conn = await pool.connect();

        try {
          for (const migration of MIGRATIONS) {
            // Check if already applied
            const checkResult = await conn.queryObject(migration.check);
            if (checkResult.rows.length > 0) {
              results.push({ name: migration.name, status: "already_applied" });
              continue;
            }

            // Run migration
            try {
              await conn.queryObject(migration.sql);
              results.push({ name: migration.name, status: "applied" });
              console.log(`[migrations] Applied: ${migration.name}`);
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              results.push({ name: migration.name, status: `error: ${errMsg}` });
              console.error(`[migrations] Error applying ${migration.name}:`, e);
            }
          }
        } finally {
          conn.release();
          await pool.end();
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return jsonResponse({ success: false, error: `DB connection failed: ${errMsg}` }, 500);
      }

      return jsonResponse({ success: true, migrations: results });
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

        // Capture the channel where the button was clicked (for ephemeral confirmation later)
        const originChannelId = payload.channel?.id ?? "";

        // IMMEDIATELY open a loading modal to beat Slack's 3-second trigger_id expiry.
        // This prevents "The link is closed" errors on cold starts.
        const loadingModal = {
          type: "modal" as const,
          title: { type: "plain_text" as const, text: "Attendance" },
          blocks: [{ type: "section", text: { type: "mrkdwn", text: ":hourglass_flowing_sand: Loading attendance form..." } }],
        };
        const openRes = await fetch("https://slack.com/api/views.open", {
          method: "POST",
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_id: triggerId, view: loadingModal }),
        });
        const openData = await openRes.json();
        if (!openData.ok) {
          console.error("views.open (loading) error:", openData.error);
          return new Response("", { status: 200 });
        }
        const viewId = openData.view?.id;

        // Helper to replace the loading modal with an error message and close
        const showModalError = async (msg: string) => {
          if (!viewId) return;
          await fetch("https://slack.com/api/views.update", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              view_id: viewId,
              view: {
                type: "modal",
                title: { type: "plain_text", text: "Attendance" },
                close: { type: "plain_text", text: "OK" },
                blocks: [{ type: "section", text: { type: "mrkdwn", text: msg } }],
              },
            }),
          });
        };

        // Now do all lookups in parallel (modal is already open, no time pressure)
        const [ride, btnProfile] = await Promise.all([
          getRideById(supabase, rideId),
          getSlackProfile(slackUserId),
        ]);
        if (!ride) { await showModalError(":warning: Could not find that practice."); return new Response("", { status: 200 }); }

        // Determine if this person is a coach or rider
        let isCoach = false;
        let isRider = false;
        let personCoachId: number | null = null;
        if (btnProfile) {
          const btnPerson = await findPerson(supabase, btnProfile);
          isCoach = !!btnPerson.coachId && !btnPerson.riderId;
          isRider = !!btnPerson.riderId && !btnPerson.coachId;
          personCoachId = btnPerson.coachId;
        }

        // Block cross-channel responses: coaches can't use rider poll, riders can't use coach poll
        const isRiderChannel = originChannelId === SLACK_ATTENDANCE_CHANNEL_ID;
        const isCoachChannel = originChannelId === SLACK_COACH_CHANNEL_ID;
        if (isCoach && isRiderChannel) {
          await showModalError(":no_entry: This is the rider attendance poll. Please use the poll in the coach channel to confirm your attendance.");
          return new Response("", { status: 200 });
        }
        if (isRider && isCoachChannel) {
          await showModalError(":no_entry: This is the coach attendance poll. Please use the poll in the rider channel to confirm your attendance.");
          return new Response("", { status: 200 });
        }

        // Block N/A level coaches from responding — they are not eligible to ride
        if (isCoach && personCoachId) {
          const { data: coachRow } = await supabase
            .from("coaches")
            .select("level")
            .eq("id", personCoachId)
            .single();
          if (coachRow?.level === "N/A") {
            await showModalError(":no_entry: You need to be a Level 1 coach or higher to participate in team rides. If you believe this is an error, please contact the head coach.");
            return new Response("", { status: 200 });
          }
        }

        // Look up existing response for pre-fill + practice times (parallel)
        const [existingResponseResult, btnTimes] = await Promise.all([
          supabase.from("slack_poll_responses").select("attendance_status").eq("ride_id", rideId).eq("slack_user_id", slackUserId).maybeSingle(),
          getPracticeTimes(supabase, ride.date),
        ]);
        let existingChoice: string | undefined;
        if (existingResponseResult.data) {
          const statusMap: Record<string, string> = { attending: "attend", absent: "absent", if_needed: "if_needed" };
          existingChoice = statusMap[existingResponseResult.data.attendance_status];
        }

        const showReason = existingChoice === "absent" && !isCoach;
        const modal = buildAttendanceModal(rideId, ride.date, btnTimes, showReason, isCoach, originChannelId, existingChoice);

        // Update the loading modal with the real attendance form
        const res = await fetch("https://slack.com/api/views.update", {
          method: "POST",
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ view_id: viewId, view: modal }),
        });
        const resData = await res.json();
        if (!resData.ok) console.error("views.update error:", resData.error);

        return new Response("", { status: 200 });
      }

      // ----- Future Practices dropdown changed (auto-save each selection) -----
      if (actionId.startsWith("future_choice_")) {
        const rideId = parseInt(actionId.replace("future_choice_", ""), 10);
        const choice = action.selected_option?.value; // "attend", "absent", "if_needed", "unknown"
        if (isNaN(rideId) || !choice) return new Response("", { status: 200 });

        // Look up the person
        const futProfile = await getSlackProfile(slackUserId);
        if (!futProfile) return new Response("", { status: 200 });
        const { riderId: futRiderId, coachId: futCoachId } = await findPerson(supabase, futProfile);
        if (!futRiderId && !futCoachId) return new Response("", { status: 200 });

        // Block N/A level coaches (belt-and-suspenders — modal open is already blocked)
        if (futCoachId && !futRiderId) {
          const { data: futCoachRow } = await supabase.from("coaches").select("level").eq("id", futCoachId).single();
          if (futCoachRow?.level === "N/A") return new Response("", { status: 200 });
        }

        if (choice === "unknown") {
          await handleUnknownResponse(supabase, rideId, slackUserId, futRiderId, futCoachId);
        } else {
          const attendanceStatus: "attending" | "absent" | "if_needed" =
            choice === "attend" ? "attending" : choice === "if_needed" ? "if_needed" : "absent";
          const addToRoster = choice !== "absent";
          await updateAttendance(supabase, rideId, futRiderId, futCoachId, addToRoster ? "add" : "remove");
          await trackPollResponse(supabase, rideId, slackUserId, futRiderId, futCoachId, attendanceStatus);
          if (futCoachId && !futRiderId) {
            await updateCoachIfNeededStatus(supabase, rideId, futCoachId, choice === "if_needed");
          }
          await clearNote(supabase, rideId, futRiderId, futCoachId);
          // Add exception date to any scheduled absence when marking "attending"/"if_needed"
          if (addToRoster) {
            (async () => {
              const rideForDate = await getRideById(supabase, rideId);
              if (rideForDate?.date) {
                await addAbsenceExceptionDate(supabase, futRiderId, futCoachId, rideForDate.date);
              }
            })().catch(e => console.error("[FUTURE] Exception date error:", e));
          }
        }

        // Update tally if a poll exists for this ride (fire-and-forget)
        updatePollTally(supabase, rideId).catch(e => console.error("Future tally error:", e));

        return new Response("", { status: 200 });
      }

      // ----- Radio button changed inside modal (show/hide reason field) -----
      if (actionId === "attendance_choice") {
        const selectedValue = action.selected_option?.value; // "attend", "absent", or "if_needed"
        const viewId = payload.view?.id;
        const viewHash = payload.view?.hash;
        const metadata = payload.view?.private_metadata;

        if (!viewId || !metadata) return new Response("", { status: 200 });

        const { rideId, dateStr, times, isCoach, channelId } = JSON.parse(metadata);
        // Only show reason field for "absent" (NOT for "if_needed")
        const showReason = selectedValue === "absent";
        const updatedModal = buildAttendanceModal(rideId, dateStr, times ?? { startTime: null, endTime: null }, showReason, isCoach ?? false, channelId ?? "", selectedValue);

        const res = await fetch("https://slack.com/api/views.update", {
          method: "POST",
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ view_id: viewId, hash: viewHash, view: updatedModal }),
        });
        const resData = await res.json();
        if (!resData.ok) console.error("views.update error:", resData.error);

        return new Response("", { status: 200 });
      }

      // ----- "Mark Future Practices" button -----
      if (actionId === "mark_future_practices") {
        const triggerId = payload.trigger_id;
        const originChannelId = payload.channel?.id ?? "";
        if (!triggerId) return new Response("", { status: 200 });

        // Phase 1: Parallel fetch — Slack profile + season_settings + rides (3 calls at once)
        const today = new Date().toISOString().slice(0, 10);
        const [futProfile, settingsResult, ridesResult] = await Promise.all([
          getSlackProfile(slackUserId),
          supabase.from("season_settings").select("practices").eq("id", "current").single(),
          supabase.from("rides").select("id, date")
            .or("cancelled.is.null,cancelled.eq.false")
            .or("deleted.is.null,deleted.eq.false")
            .gte("date", today).order("date", { ascending: true }).limit(50),
        ]);

        // Phase 2: Parallel — findPerson (needs profile) runs alongside computing planned rides
        const practices: any[] = Array.isArray(settingsResult.data?.practices) ? settingsResult.data.practices : [];
        const allRides = ridesResult.data ?? [];
        const planned = practices.length > 0 ? allRides.filter(r => isPlannedPractice(r.date, practices)) : allRides;
        // Deduplicate: keep only the first ride per date
        const seenDates2 = new Set<string>();
        const dedupedPlanned = planned.filter(r => {
          if (seenDates2.has(r.date)) return false;
          seenDates2.add(r.date);
          return true;
        });
        const upcomingRides = dedupedPlanned.slice(1, 26); // Skip first (current practice), cap at 25

        // Determine coach/rider
        let isCoach = false;
        let isRider = false;
        if (futProfile) {
          const futPerson = await findPerson(supabase, futProfile);
          isCoach = !!futPerson.coachId && !futPerson.riderId;
          isRider = !!futPerson.riderId && !futPerson.coachId;
        }

        // Cross-channel guard
        const isRiderChannel = originChannelId === SLACK_ATTENDANCE_CHANNEL_ID;
        const isCoachChannel = originChannelId === SLACK_COACH_CHANNEL_ID;
        if (isCoach && isRiderChannel) {
          fetch("https://slack.com/api/chat.postEphemeral", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: originChannelId, user: slackUserId,
              text: ":no_entry: This is the rider attendance poll. Please use the poll in the coach channel.",
            }),
          });
          return new Response("", { status: 200 });
        }
        if (isRider && isCoachChannel) {
          fetch("https://slack.com/api/chat.postEphemeral", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: originChannelId, user: slackUserId,
              text: ":no_entry: This is the coach attendance poll. Please use the poll in the rider channel.",
            }),
          });
          return new Response("", { status: 200 });
        }

        // Block N/A level coaches from future attendance marking
        if (isCoach && futProfile) {
          const futPerson = await findPerson(supabase, futProfile);
          if (futPerson.coachId) {
            const { data: coachRow } = await supabase
              .from("coaches")
              .select("level")
              .eq("id", futPerson.coachId)
              .single();
            if (coachRow?.level === "N/A") {
              fetch("https://slack.com/api/chat.postEphemeral", {
                method: "POST",
                headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  channel: originChannelId, user: slackUserId,
                  text: ":no_entry: You need to be a Level 1 coach or higher to participate in team rides.",
                }),
              });
              return new Response("", { status: 200 });
            }
          }
        }

        if (upcomingRides.length === 0) {
          fetch("https://slack.com/api/chat.postEphemeral", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: originChannelId, user: slackUserId,
              text: "No future practices found to mark attendance for.",
            }),
          });
          return new Response("", { status: 200 });
        }

        // Phase 3: Batch-fetch existing responses (single DB call)
        const rideIds = upcomingRides.map(r => r.id);
        const { data: existingResponses } = await supabase
          .from("slack_poll_responses")
          .select("ride_id, attendance_status")
          .eq("slack_user_id", slackUserId)
          .in("ride_id", rideIds);
        const responseMap = new Map<number, string>();
        for (const r of existingResponses ?? []) {
          responseMap.set(r.ride_id, r.attendance_status);
        }

        // Compute practice times in-memory (no extra DB calls — uses already-fetched practices)
        const uniqueDates = [...new Set(upcomingRides.map(r => r.date))];
        const timesMap = new Map<string, { startTime: string | null; endTime: string | null }>();
        for (const dateStr of uniqueDates) {
          timesMap.set(dateStr, computeTimesForDate(practices, dateStr));
        }

        // Build and open the future attendance modal
        const futureModal = buildFutureAttendanceModal(upcomingRides, isCoach, originChannelId, responseMap, timesMap);
        const res = await fetch("https://slack.com/api/views.open", {
          method: "POST",
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_id: triggerId, view: futureModal }),
        });
        const resData = await res.json();
        if (!resData.ok) console.error("views.open error (future):", resData.error);

        return new Response("", { status: 200 });
      }

      // ----- "Mute future reminders" button (coach opt-out) -----
      if (actionId === "opt_out_reminders") {
        const profile = await getSlackProfile(slackUserId);
        if (profile) {
          const person = await findPerson(supabase, profile);
          if (person.coachId) {
            await supabase
              .from("coaches")
              .update({ slack_reminders_disabled: true })
              .eq("id", person.coachId);
            console.log(`[opt_out] Coach ${person.coachId} (${profile.realName}) opted out of reminders`);
          }
        }

        // Replace the original message with confirmation + unmute option
        const responseUrl = payload.response_url;
        if (responseUrl) {
          fetch(responseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              replace_original: true,
              text: "DM reminders muted.",
              blocks: [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: ":no_bell: *DM reminders muted.* You won't receive attendance reminder DMs for future practices." },
                },
                {
                  type: "actions",
                  elements: [{
                    type: "button",
                    text: { type: "plain_text", text: "Unmute reminders", emoji: true },
                    action_id: "opt_in_reminders",
                    value: "opt_in",
                  }],
                },
              ],
            }),
          });
        }
        return new Response("", { status: 200 });
      }

      // ----- "Unmute reminders" button (coach opt back in) -----
      if (actionId === "opt_in_reminders") {
        const profile = await getSlackProfile(slackUserId);
        if (profile) {
          const person = await findPerson(supabase, profile);
          if (person.coachId) {
            await supabase
              .from("coaches")
              .update({ slack_reminders_disabled: false })
              .eq("id", person.coachId);
            console.log(`[opt_in] Coach ${person.coachId} (${profile.realName}) opted back in to reminders`);
          }
        }

        // Replace message with confirmation
        const responseUrl = payload.response_url;
        if (responseUrl) {
          fetch(responseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              replace_original: true,
              text: "DM reminders re-enabled.",
              blocks: [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: ":bell: *DM reminders re-enabled.* You'll receive attendance reminders for future practices." },
                },
              ],
            }),
          });
        }
        return new Response("", { status: 200 });
      }

      // ----- "DM Head Coaches" button (rider poll) -----
      if (actionId === "dm_head_coaches") {
        // Open a modal for the rider to compose a message to head coaches
        const triggerId = payload.trigger_id;
        if (triggerId) {
          const modal = {
            type: "modal",
            callback_id: "dm_head_coaches_submit",
            title: { type: "plain_text", text: "Message Head Coaches" },
            submit: { type: "plain_text", text: "Send Message" },
            close: { type: "plain_text", text: "Cancel" },
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: "Your message will be sent as a DM to the team's head coaches." },
              },
              {
                type: "input",
                block_id: "message_block",
                element: {
                  type: "plain_text_input",
                  action_id: "coach_message",
                  multiline: true,
                  placeholder: { type: "plain_text", text: "Explain your situation and expected duration of absence..." },
                },
                label: { type: "plain_text", text: "Your message" },
              },
            ],
          };
          await fetch("https://slack.com/api/views.open", {
            method: "POST",
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ trigger_id: triggerId, view: modal }),
          });
        }
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

      // ----- DM Head Coaches modal submission -----
      if (callbackId === "dm_head_coaches_submit") {
        const message = values?.message_block?.coach_message?.value?.trim() ?? "";
        if (!message) {
          return new Response(JSON.stringify({
            response_action: "errors",
            errors: { message_block: "Please enter a message." },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Look up the sender's name from their Slack profile
        const senderProfile = await getSlackProfile(slackUserId);
        const senderName = senderProfile?.realName || senderProfile?.displayName || "A rider";

        // Head coaches: Scott Martin and Sami Mahrus — look up their Slack IDs via coach table
        const HEAD_COACH_NAMES = ["Scott Martin", "Sami Mahrus"];
        const headCoachSlackIds: string[] = [];

        for (const coachName of HEAD_COACH_NAMES) {
          // Find coach by name
          const { data: coaches } = await supabase
            .from("coaches")
            .select("id")
            .ilike("name", coachName)
            .limit(1);
          const coachId = coaches?.[0]?.id;
          if (coachId) {
            // Find their Slack ID from past poll responses
            const { data: responses } = await supabase
              .from("slack_poll_responses")
              .select("slack_user_id")
              .eq("coach_id", coachId)
              .limit(1);
            if (responses?.[0]?.slack_user_id) {
              headCoachSlackIds.push(responses[0].slack_user_id);
            }
          }
        }

        if (headCoachSlackIds.length === 0) {
          console.error("[DM_COACHES] Could not find Slack IDs for head coaches");
          return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Send DM to each head coach
        for (const coachSlackId of headCoachSlackIds) {
          (async () => {
            try {
              const openRes = await fetch("https://slack.com/api/conversations.open", {
                method: "POST",
                headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ users: coachSlackId }),
              });
              const openData = await openRes.json();
              if (!openData.ok) { console.error(`[DM_COACHES] conversations.open error:`, openData.error); return; }

              await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  channel: openData.channel.id,
                  text: `Message from ${senderName}: ${message}`,
                  blocks: [
                    {
                      type: "section",
                      text: {
                        type: "mrkdwn",
                        text: `:envelope: *Message from <@${slackUserId}>:*\n\n${message}`,
                      },
                    },
                  ],
                }),
              });
              console.log(`[DM_COACHES] Forwarded message from ${senderName} to coach ${coachSlackId}`);
            } catch (e) { console.error("[DM_COACHES] Error sending DM:", e); }
          })();
        }

        return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // ----- Attendance modal submission -----
      if (callbackId.startsWith("attendance_")) {
        const rideId = parseInt(callbackId.replace("attendance_", ""), 10);
        if (isNaN(rideId) || !slackUserId) {
          return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        const choice = values?.choice_block?.attendance_choice?.selected_option?.value; // "attend", "absent", or "if_needed"

        if (!choice) {
          // No selection made — show validation error
          return new Response(JSON.stringify({
            response_action: "errors",
            errors: { choice_block: "Please select whether you will attend or not." },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Map choice to attendance status and action
        // Both "attend" and "if_needed" keep the person in available_coaches
        const attendanceStatus: "attending" | "absent" | "if_needed" =
          choice === "attend" ? "attending" : choice === "if_needed" ? "if_needed" : "absent";
        const addToRoster = choice !== "absent"; // "attend" and "if_needed" both stay available

        const reason = values?.reason_block?.reason_input?.value?.trim() ?? "";
        const comments = values?.comments_block?.comments_input?.value?.trim() ?? "";
        const parsedMeta = metadata ? JSON.parse(metadata) : {};
        const isCoachSubmission = parsedMeta.isCoach ?? false;

        // Validate: reason is required only for RIDERS selecting "absent" (coaches don't need a reason)
        if (choice === "absent" && !reason && !isCoachSubmission) {
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

        const { riderId, coachId, matchedBy } = await findPerson(supabase, profile);
        console.log(`[ATTENDANCE] findPerson result: riderId=${riderId}, coachId=${coachId}, matchedBy=${matchedBy}, slackUser=${slackUserId}, email=${profile.email}, name=${profile.realName}`);
        if (!riderId && !coachId) {
          console.log(`[ATTENDANCE] No match found — aborting. Profile: email=${profile.email}, name=${profile.realName}, phone=${profile.phone}`);
          return new Response(JSON.stringify({ response_action: "clear" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Block N/A level coaches from responding — they are not eligible to ride
        if (coachId && !riderId) {
          const { data: coachRow } = await supabase
            .from("coaches")
            .select("level")
            .eq("id", coachId)
            .single();
          if (coachRow?.level === "N/A") {
            console.log(`[ATTENDANCE] N/A coach blocked: coachId=${coachId}, slackUser=${slackUserId}`);
            return new Response(JSON.stringify({
              response_action: "update",
              view: {
                type: "modal",
                title: { type: "plain_text", text: "Not Eligible" },
                close: { type: "plain_text", text: "OK" },
                blocks: [{
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: ":no_entry: *You need to be a Level 1 coach or higher to participate in team rides.*\n\nIf you believe this is an error, please contact the head coach.",
                  },
                }],
              },
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // Update attendance on the ride record
        const rosterAction = addToRoster ? "add" : "remove";
        console.log(`[ATTENDANCE] Calling updateAttendance: rideId=${rideId}, riderId=${riderId}, coachId=${coachId}, action=${rosterAction}`);
        const updateResult = await updateAttendance(supabase, rideId, riderId, coachId, rosterAction);
        console.log(`[ATTENDANCE] updateAttendance returned: ${updateResult}`);

        // If marking "attending" (or "if_needed"), add an exception date to any scheduled
        // absence covering this practice so TeamRide Pro's auto-removal doesn't override.
        if (addToRoster) {
          // Get the ride date for the exception (fire-and-forget to not block modal response)
          (async () => {
            const rideForDate = await getRideById(supabase, rideId);
            if (rideForDate?.date) {
              await addAbsenceExceptionDate(supabase, riderId, coachId, rideForDate.date);
            }
          })().catch(e => console.error("[ATTENDANCE] Exception date error:", e));
        }

        // Save or clear notes: if reason or comments provided, save; otherwise clear stale notes
        const noteText = choice === "absent" && reason ? reason : comments || "";
        if (noteText) {
          await saveAbsenceReason(supabase, rideId, riderId, coachId, noteText);
        } else {
          // Clear any previous note (e.g., coach changed from "if_needed + comment" to "attending")
          await clearNote(supabase, rideId, riderId, coachId);
        }

        // Update coachIfNeeded status on the ride settings (coaches only)
        if (coachId && !riderId) {
          await updateCoachIfNeededStatus(supabase, rideId, coachId, choice === "if_needed");
        }

        // Check if this is an update (previous response exists for this user+ride)
        const { data: prevResponse } = await supabase
          .from("slack_poll_responses")
          .select("id")
          .eq("ride_id", rideId)
          .eq("slack_user_id", slackUserId)
          .maybeSingle();
        const isUpdate = !!prevResponse;

        // Track the poll response and update the live tally on the original message
        await trackPollResponse(supabase, rideId, slackUserId, riderId, coachId, attendanceStatus);
        // Fire-and-forget tally update (don't block the modal response)
        updatePollTally(supabase, rideId).catch((e) => console.error("Tally update error:", e));

        // Get ride date and originating channel for ephemeral confirmation
        const ride = await getRideById(supabase, rideId);
        const dateStr = ride?.date ?? (metadata ? JSON.parse(metadata).dateStr : "unknown");
        const channelId = metadata ? JSON.parse(metadata).channelId : "";

        // Post ephemeral confirmation with timestamp back to the originating channel
        if (channelId) {
          try {
            const confirmation = buildConfirmationBlocks(
              rideId, dateStr, attendanceStatus, isUpdate,
              reason || undefined, comments || undefined
            );
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
          } catch (e) {
            console.error("Error posting ephemeral confirmation:", e);
          }
        }

        // Post-publish change notice: if groups are already published, DM the person
        if (ride?.published_groups === true) {
          (async () => {
            try {
              const openRes = await fetch("https://slack.com/api/conversations.open", {
                method: "POST",
                headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ users: slackUserId }),
              });
              const openData = await openRes.json();
              if (!openData.ok) { console.error("[POST-PUBLISH] conversations.open error:", openData.error); return; }

              const friendlyDate = formatDate(ride.date);
              await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  channel: openData.channel.id,
                  text: "Ride groups for this practice have already been set and distributed, please contact the head coach directly to advise them of this change.",
                  blocks: [{
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `:warning: *Ride groups for ${friendlyDate} have already been set and distributed.*\nPlease contact the head coach directly to advise them of this change.`,
                    },
                  }],
                }),
              });
              console.log(`[POST-PUBLISH] Sent change notice DM to ${slackUserId} for ride ${rideId}`);
            } catch (e) { console.error("[POST-PUBLISH] Error sending change notice:", e); }
          })().catch(e => console.error("[POST-PUBLISH] Unhandled:", e));
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
    trackPollResponse(supabase, ride.id, slackUserId, riderId, coachId, "attending").catch((e) => console.error("Track error:", e));
    updatePollTally(supabase, ride.id).catch((e) => console.error("Tally error:", e));
    // Add exception date to any scheduled absence (fire-and-forget)
    addAbsenceExceptionDate(supabase, riderId, coachId, ride.date).catch((e) => console.error("Exception date error:", e));
  }

  return updated
    ? ephemeral(`You're marked in for practice on ${friendlyDate}. See you there!`)
    : ephemeral(`There was a problem updating attendance for ${friendlyDate}. Please try again or contact an admin.`);
});
