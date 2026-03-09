# SMS Attendance Notifications — Implementation Plan

> Saved for future implementation. Slack poll is being built first.

## Context

Send automated SMS messages before each practice asking "Will you attend? Y/N" and auto-update attendance from replies.

## Existing Infrastructure

- **Twilio**: Already configured with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` secrets in Supabase
- **Phone numbers**: Stored on `riders.phone` and `coaches.phone`
- **`send-verification-code` edge function**: Has working Twilio SMS sending + `toE164()` phone normalization
- **Attendance model**: `rider_availability` table + `rides.available_riders[]` / `available_coaches[]`

## How It Would Work

1. **Scheduled trigger** (pg_cron or external cron) fires X hours before each practice
2. New edge function `send-attendance-sms` queries upcoming ride + all riders/coaches with phone numbers
3. Sends each person an SMS: *"Tam High MTB: Practice on [DAY, DATE]. Will you be there? Reply Y or N"*
4. Rider replies "Y" or "N" to the Twilio number
5. Twilio forwards the inbound SMS to a **webhook edge function** (`receive-attendance-sms`)
6. Function matches phone → rider/coach, parses Y/N, updates `available_riders`/`available_coaches`
7. Sends confirmation SMS back

## Components to Build

### 1. `send-attendance-sms` Edge Function

**File**: `supabase/functions/send-attendance-sms/index.ts`

- Queries the next upcoming ride (not cancelled, date >= today)
- Fetches all non-archived riders and coaches with phone numbers
- Sends each person an SMS via Twilio
- Logs each send to `sms_attendance_log`
- Use service role key to query riders/coaches (bypasses RLS)

### 2. `receive-attendance-sms` Edge Function

**File**: `supabase/functions/receive-attendance-sms/index.ts`

Twilio webhook endpoint:
- Receives POST with `From` (phone), `Body` (message text)
- Normalizes phone and looks up rider/coach
- Parses response (Y/Yes/yeah/N/No/nah — fuzzy matching)
- Finds the most recent pending practice for that person
- Updates `available_riders[]` or `available_coaches[]` on the ride
- Optionally updates `rider_availability` table
- Sends confirmation SMS back
- Deploy with `--no-verify-jwt`
- Validate Twilio `X-Twilio-Signature` header

### 3. `sms_attendance_log` Table

```sql
CREATE TABLE IF NOT EXISTS sms_attendance_log (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id BIGINT REFERENCES riders(id) ON DELETE SET NULL,
  coach_id BIGINT REFERENCES coaches(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response TEXT,
  parsed_response BOOLEAN,
  responded_at TIMESTAMPTZ,
  confirmation_sent BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_person CHECK (rider_id IS NOT NULL OR coach_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sms_attendance_log_phone ON sms_attendance_log(phone);
CREATE INDEX IF NOT EXISTS idx_sms_attendance_log_ride ON sms_attendance_log(ride_id);
```

### 4. Twilio Inbound Webhook Config

In Twilio console → Phone Numbers → your number:
- Set "A Message Comes In" webhook URL to edge function URL
- HTTP method: POST

### 5. Scheduling

- **pg_cron**: `SELECT cron.schedule('send-reminders', '0 18 * * 2,4', ...)`
- Or external cron (GitHub Actions, cron-job.org) hitting the function URL with a secret header

## Reusable Code

- `toE164()` from `send-verification-code/index.ts:92-97`
- Twilio API call pattern from `send-verification-code/index.ts:137-151`
- Ride query pattern from `SLACK_ATTENDANCE_INTEGRATION.md`

## Cost Estimate

- ~40 people × 2 practices/week × 3 msgs (out + in + confirm) = ~240 msgs/week
- At ~$0.008/msg + carrier fees ≈ **$8-10/month**
- Twilio phone number: $1.15/month
