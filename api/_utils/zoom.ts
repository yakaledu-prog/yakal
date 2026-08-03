// ============================================================
// Zoom, server side.
//
// One Server-to-Server OAuth app owns every meeting on the platform. That is a
// deliberate limit rather than an oversight: per-tutor hosts would need each
// tutor to hold a licensed seat on the Zoom account, which is a billing
// decision, not a code one. Until then meetings are created under the account
// owner and everyone joins as a participant.
//
// The token lasts an hour and is reused, because a serverless invocation that
// creates six meetings should not fetch six tokens.
//
// Every call here is allowed to fail. Zoom being down must never stop a paid
// course from being fulfilled, so callers log and carry on with a session that
// has no meeting yet.
// ============================================================

const OAUTH = "https://zoom.us/oauth/token";
const API = "https://api.zoom.us/v2";

/**
 * Sessions store a naive date and time, so the meeting has to be told which
 * wall clock they are on. The platform runs in the US; a deployment elsewhere
 * sets ZOOM_TIMEZONE.
 */
const TIMEZONE = process.env.ZOOM_TIMEZONE || "America/New_York";

export interface ZoomMeeting {
  meetingId: string;
  password: string | null;
  joinUrl: string | null;
}

export interface ZoomParticipant {
  name: string;
  email: string | null;
  joinTime: string | null;
  leaveTime: string | null;
  minutes: number;
}

/** False when the credentials are absent, so local work without them is quiet. */
export function zoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_S2S_ACCOUNT_ID &&
      process.env.ZOOM_S2S_CLIENT_ID &&
      process.env.ZOOM_S2S_CLIENT_SECRET
  );
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getZoomToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const accountId = process.env.ZOOM_S2S_ACCOUNT_ID;
  const clientId = process.env.ZOOM_S2S_CLIENT_ID;
  const clientSecret = process.env.ZOOM_S2S_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom S2S credentials are not configured");
  }

  const res = await fetch(`${OAUTH}?grant_type=account_credentials&account_id=${accountId}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!res.ok) throw new Error(`Zoom token failed: ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // A minute of headroom, so a token cannot expire between the check and the
  // request that uses it.
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cached.token;
}

async function zoomFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getZoomToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/**
 * A scheduled meeting for one session.
 *
 * `date` is yyyy-mm-dd and `startTime` is HH:MM, exactly as the session row
 * holds them. They are sent as local time alongside the timezone rather than
 * converted to UTC here, so daylight saving stays Zoom's problem.
 */
export async function createMeeting(input: {
  topic: string;
  agenda?: string;
  date: string;
  startTime: string;
  durationMinutes?: number;
}): Promise<ZoomMeeting> {
  const start = `${input.date}T${input.startTime.slice(0, 5)}:00`;

  const res = await zoomFetch("/users/me/meetings", {
    method: "POST",
    body: JSON.stringify({
      topic: input.topic.slice(0, 200),
      agenda: input.agenda?.slice(0, 2000),
      type: 2,
      start_time: start,
      duration: input.durationMinutes ?? 60,
      timezone: TIMEZONE,
      settings: {
        host_video: true,
        participant_video: true,
        // The tutor is a participant, not the host, so the meeting has to open
        // without one waiting for the account owner to arrive.
        join_before_host: true,
        waiting_room: false,
        approval_type: 0,
      },
    }),
  });

  if (!res.ok) throw new Error(`Zoom create failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { id: number | string; password?: string | null; join_url?: string | null };
  return {
    meetingId: String(data.id),
    password: data.password ?? null,
    joinUrl: data.join_url ?? null,
  };
}

/**
 * Move an existing meeting.
 *
 * The timezone is resent with every change. Zoom keeps the one the meeting was
 * created with, but a naive start_time arriving without it is read as UTC, so
 * a rescheduled session would quietly shift by the offset.
 */
export async function updateMeeting(input: {
  meetingId: string;
  topic?: string;
  date: string;
  startTime: string;
  durationMinutes?: number;
}): Promise<void> {
  const res = await zoomFetch(`/meetings/${input.meetingId}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic: input.topic?.slice(0, 200),
      start_time: `${input.date}T${input.startTime.slice(0, 5)}:00`,
      duration: input.durationMinutes ?? 60,
      timezone: TIMEZONE,
    }),
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Zoom update failed (${res.status}): ${await res.text()}`);
  }
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const res = await zoomFetch(`/meetings/${meetingId}`, { method: "DELETE" });
  // 404 means it is already gone, which is the state we wanted.
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    throw new Error(`Zoom delete failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Who actually turned up, and for how long.
 *
 * Not usable on a free Zoom account. The scope is granted and the call is
 * shaped correctly, but Zoom answers 400 with "Only available for Paid or ZMP
 * account" whoever asks, so attendance cannot be read back over REST until the
 * account is on Pro. Attendance is therefore recorded from our own client and
 * this is the corroborating source, not the primary one.
 *
 * Returns null when Zoom has no record of the meeting having taken place,
 * which is different from a record showing nobody came.
 */
export async function getPastParticipants(meetingId: string): Promise<ZoomParticipant[] | null> {
  const res = await zoomFetch(
    `/past_meetings/${encodeURIComponent(meetingId)}/participants?page_size=300`
  );

  // 404 is the usual answer for a meeting that was scheduled and never started.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Zoom participants failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { participants?: any[] };
  const rows: any[] = data.participants ?? [];

  // Zoom lists one row per join, so a dropped connection reads as two short
  // visits. Merging by identity is what makes "stayed 30 minutes" true.
  const byPerson = new Map<string, ZoomParticipant>();
  for (const r of rows) {
    const key = (r.user_email || r.name || r.id || "").toLowerCase();
    const minutes = Math.round((r.duration ?? 0) / 60);
    const existing = byPerson.get(key);
    if (existing) {
      existing.minutes += minutes;
      existing.leaveTime = r.leave_time ?? existing.leaveTime;
      continue;
    }
    byPerson.set(key, {
      name: r.name ?? "",
      email: r.user_email || null,
      joinTime: r.join_time ?? null,
      leaveTime: r.leave_time ?? null,
      minutes,
    });
  }

  return [...byPerson.values()];
}
