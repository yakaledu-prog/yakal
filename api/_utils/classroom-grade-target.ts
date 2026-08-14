// ============================================================
// Which Classroom studentSubmission a Yakal grade should be written back to.
//
// The no-sign-in model means a Yakal student is not, in general, a member of
// the Google class, and Classroom keys a submission by its own user id, not an
// email. So a write-back is only possible when the student happens to be on the
// class roster: match the Yakal email to a roster entry to get the Classroom
// user id, then find that user's submission. No match means there is nothing to
// write to, which the caller reports rather than failing.
//
// Pure and free of the googleapis client, so the matching can be checked
// without a network. See P4 in docs/architecture/google-classroom.md.
// ============================================================

export interface RosterEntry {
  userId: string;
  email: string | null;
}

export interface RemoteSubmission {
  id: string;
  userId: string;
}

export function classroomSubmissionFor(
  studentEmail: string | null,
  roster: RosterEntry[],
  submissions: RemoteSubmission[]
): string | null {
  const email = studentEmail?.trim().toLowerCase();
  if (!email) return null;
  const entry = roster.find((r) => (r.email ?? "").trim().toLowerCase() === email);
  if (!entry) return null;
  const submission = submissions.find((s) => s.userId === entry.userId);
  return submission?.id ?? null;
}
