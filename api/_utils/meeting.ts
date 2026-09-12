import { createMeeting, deleteMeeting, zoomConfigured } from "./zoom.js";

/**
 * Give one session a Zoom meeting of its own.
 *
 * Lifted out of fulfil.ts, which had this right for lessons and kept it to
 * itself. Advising hours were being written with no meeting at all and falling
 * back to the counsellor's personal room, which is one URL shared by every
 * student they see, published in the contact panel, and invisible to both
 * attendance systems: the webhook matches on zoom_meeting_id and the in-app
 * heartbeat only runs on a page that is routed to when one exists. With no
 * attendance the no-show branch of the scheduled job could never fire, so every
 * advising hour completed itself, and a completed advising hour is the whole of
 * what counselling_period_delivered asks before releasing a counsellor's month.
 *
 * One helper so fulfilment and advising cannot drift on settings like
 * join_before_host, which decides whether anybody can get into the room before
 * the account owner does.
 */
export interface MeetinglessSession {
  id: string;
  date: string;
  start_time: string;
  duration_minutes: number | null;
}

/**
 * True when this call is the one that attached the meeting.
 *
 * False covers three different things that all mean "carry on": Zoom is not
 * configured, somebody else claimed the row first, or Zoom refused. None of
 * them is worth failing a booking over, because the hour is booked either way
 * and the sweep in run-jobs comes back for the room.
 */
export async function attachMeeting(
  db: any,
  session: MeetinglessSession,
  topic: string
): Promise<boolean> {
  if (!zoomConfigured()) return false;

  let meeting;
  try {
    meeting = await createMeeting({
      topic,
      date: session.date,
      startTime: String(session.start_time),
      durationMinutes: session.duration_minutes ?? 60,
    });
  } catch (err: any) {
    // The session keeps its time and loses only its room, which the next
    // sweep, or a rebooking, can still put right.
    console.error(`meeting: none for session ${session.id}:`, err?.message ?? err);
    return false;
  }

  // Two callers can be here at once: the booking and the sweep, or two tabs.
  // The claim is guarded on the column still being null so exactly one wins,
  // and the loser takes its own meeting off the calendar rather than leaving
  // half the people in an empty room.
  const { data: claimed, error } = await db
    .from("sessions")
    .update({
      zoom_meeting_id: meeting.meetingId,
      zoom_password: meeting.password,
      zoom_link: meeting.joinUrl,
    })
    .eq("id", session.id)
    .is("zoom_meeting_id", null)
    .select("id");

  if (error || !claimed?.length) {
    await deleteMeeting(meeting.meetingId).catch(() => {});
    if (error) console.error(`meeting: could not claim session ${session.id}:`, error.message);
    return false;
  }

  return true;
}
