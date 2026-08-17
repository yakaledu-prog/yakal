import type { VercelRequest, VercelResponse } from '@vercel/node';
// The Classroom client alone. See the note in drive.ts: the full googleapis
// package is 204 MB and took this whole function over Vercel's limit.
import { classroom_v1, auth as googleAuth } from '@googleapis/classroom';

import { getServiceClient, requireUser } from '../_utils/supabase.js';

/**
 * Google Classroom, read through an account Yakal controls.
 *
 * The same argument as Drive, for the same reasons. Reading a class from the
 * browser meant every reader signing into Google first:
 *
 *  - A student had to have a Google account, sign in, consent to Classroom
 *    scopes, and be a member of the class, before they could see that homework
 *    exists. Most of them gave up somewhere in there, which meant the work was
 *    set and nobody saw it.
 *  - Tokens are per user and expire hourly, so the consent screen came back.
 *  - Nothing in the product needs a student's Google identity. The class is
 *    ours; what they need is to read it.
 *
 * So the server holds one credential, the operations account that owns every
 * class, and answers on behalf of whoever is entitled to ask. A family books a
 * course and the work appears. Nobody signs into anything.
 *
 * That makes authorisation this file's real job. The credential can read every
 * class Yakal owns, so a request that named any course would otherwise hand
 * one family another family's classroom. Entitlement is checked against the
 * database, per request, before Google is touched at all.
 *
 * Environment:
 *   GOOGLE_OAUTH_REFRESH_TOKEN   the operations account that owns the classes
 *   VITE_GCP_CLIENT_ID
 *   GCP_CLIENT_SECRET
 */

/**
 * The numeric class id inside a Classroom URL.
 *
 * The web app's /c/ segment is the numeric id in base64, but not always: an id
 * that does not decode to digits is already the id. Mirrors courseIdFromUrl in
 * src/services/classroomService.ts.
 */
export function courseIdFromUrl(url: string): string | null {
  const match = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    if (/^\d+$/.test(decoded)) return decoded;
  } catch {
    // Not base64. Some links carry the raw id already.
  }
  return match[1];
}

/**
 * Where a learner stands with the Google class.
 *
 * Only membership decides whether Classroom has submissions for them, and only
 * membership lets them turn work in. Reading the coursework needs none of it,
 * because the server reads as the account that owns the class, so a student who
 * never joins still sees everything that was set.
 */
export type Membership = 'joined' | 'invited' | 'none';

export async function membershipOf(
  classroom: classroom_v1.Classroom,
  classId: string,
  email: string
): Promise<{ membership: Membership; googleId: string | null }> {
  // Classroom accepts an email wherever it accepts a userId, so this is one
  // lookup rather than paging the roster.
  const googleId = await classroom.courses.students
    .get({ courseId: classId, userId: email })
    .then((r: any) => (r?.data?.userId ? String(r.data.userId) : null))
    .catch(() => null);
  if (googleId) return { membership: 'joined', googleId };

  // Not on the roster. An outstanding invitation is a different state to
  // never having been asked, and it is the difference between showing a
  // student a Join button and telling an admin to send one.
  const invited = await classroom.invitations
    .list({ courseId: classId, userId: email })
    .then((r: any) => (r?.data?.invitations ?? []).length > 0)
    .catch(() => false);

  return { membership: invited ? 'invited' : 'none', googleId: null };
}

export function classroomClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('GOOGLE_OAUTH_REFRESH_TOKEN is not set');
  }
  const auth = new googleAuth.OAuth2(
    process.env.VITE_GCP_CLIENT_ID,
    process.env.GCP_CLIENT_SECRET
  );
  // No scope here. A refresh token carries whatever was consented when it was
  // minted, and naming scopes it does not have would only mislead the next
  // person reading this. scripts/google-oauth-setup.mjs is where they are asked
  // for.
  auth.setCredentials({ refresh_token: refreshToken });
  return new classroom_v1.Classroom({ auth });
}

/**
 * Whether this user may read this course's work.
 *
 * Deliberately explicit rather than "is signed in". The four ways in are the
 * four relationships the product actually has to a course.
 */
/**
 * Whether a reader may see one piece of coursework.
 *
 * Staff see the class as a teacher does. A learner sees work assigned to
 * everyone, plus work assigned individually to them.
 *
 * The syllabus model does not use individual assignment, so in normal use
 * every item is ALL_STUDENTS and this changes nothing. It exists because
 * "assign to specific students" is a button in Classroom's own dialog and a
 * tutor will eventually press it. Without this, the first time they did, every
 * student on the course would read that assignment.
 *
 * A learner we cannot place in the class is excluded rather than included.
 * Being unable to prove the work is theirs is exactly the case where showing
 * it is a leak.
 */
export function isVisibleTo(
  work: { assigneeMode?: string; individualStudentsOptions?: { studentIds?: string[] } },
  reader: Reader,
  readerGoogleId: string | null
): boolean {
  if (reader.kind === 'staff') return true;
  if (reader.kind === 'denied') return false;
  if (work.assigneeMode !== 'INDIVIDUAL_STUDENTS') return true;
  if (!readerGoogleId) return false;
  return (work.individualStudentsOptions?.studentIds ?? []).map(String).includes(readerGoogleId);
}

export type Reader =
  /** Sees the whole class, the way a teacher does. */
  | { kind: 'staff' }
  /** Sees only what is assigned to this person. */
  | { kind: 'learner'; email: string | null }
  | { kind: 'denied' };

/** One raw Classroom submission, in the terms the assignment list uses. */
export function readSubmission(s: any) {
  return {
    courseWorkId: String(s?.courseWorkId ?? ''),
    userId: String(s?.userId ?? ''),
    // TURNED_IN is waiting to be marked, RETURNED has been marked and handed
    // back. Both mean the student did the work, which is the question the list
    // is answering. NEW and CREATED do not.
    isSubmitted: s?.state === 'TURNED_IN' || s?.state === 'RETURNED',
    // assignedGrade is the mark the student can see in Classroom. draftGrade is
    // the tutor's working note on a paper they have not handed back, so showing
    // it here would tell a student a result that has not been given yet.
    grade: typeof s?.assignedGrade === 'number' ? s.assignedGrade : null,
    late: !!s?.late,
  };
}

export type Submission = ReturnType<typeof readSubmission>;

/**
 * Who has turned in each piece of work, keyed by assignment id.
 *
 * Only for staff. A learner is told about their own submission and nothing
 * about anybody else's, which is why this takes the whole class's submissions
 * and the learner path never calls it.
 *
 * A submitter missing from the roster is still counted. Classroom keeps the
 * submission when a student leaves the class, and dropping them would quietly
 * reduce a count a tutor may have already acted on.
 */
export function submittersByWork(
  submissions: Submission[],
  roster: Map<string, { name: string; avatarUrl: string | null }>
): Record<string, { id: string; name: string; avatarUrl: string | null }[]> {
  const byWork: Record<string, { id: string; name: string; avatarUrl: string | null }[]> = {};
  for (const s of submissions) {
    if (!s.isSubmitted || !s.courseWorkId) continue;
    const person = roster.get(s.userId);
    (byWork[s.courseWorkId] ??= []).push({
      id: s.userId,
      name: person?.name ?? 'Student',
      avatarUrl: person?.avatarUrl ?? null,
    });
  }
  return byWork;
}

async function readerFor(db: any, userId: string, courseId: string): Promise<Reader> {
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.role === 'admin') return { kind: 'staff' };

  // The tutor teaching it.
  const { data: course } = await db
    .from('courses')
    .select('tutor_id')
    .eq('id', courseId)
    .maybeSingle();
  if (course?.tutor_id && course.tutor_id === userId) return { kind: 'staff' };

  // A student enrolled on it.
  const { count: enrolled } = await db
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('student_id', userId);
  if ((enrolled ?? 0) > 0) {
    const { data: me } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
    return { kind: 'learner', email: me?.email ?? null };
  }

  // A parent of a student enrolled on it. They paid for the course, and being
  // able to see what was set is most of what they paid for. They see exactly
  // what their child sees, which is why they read as a learner rather than as
  // staff: an assignment set for one child is not the other's to read either.
  const { data: links } = await db
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', userId)
    .eq('status', 'active');

  const childIds = (links ?? []).map((l: any) => l.student_id);
  if (childIds.length > 0) {
    const { data: enrolledChild } = await db
      .from('enrolments')
      .select('student_id')
      .eq('course_id', courseId)
      .in('student_id', childIds)
      .limit(1)
      .maybeSingle();

    if (enrolledChild?.student_id) {
      const { data: child } = await db
        .from('profiles')
        .select('email')
        .eq('id', enrolledChild.student_id)
        .maybeSingle();
      return { kind: 'learner', email: child?.email ?? null };
    }
  }

  return { kind: 'denied' };
}

/** Classroom sends a due date as three numbers, and omits it when there is none. */
function readDueDate(due: any): string | null {
  if (!due?.year || !due?.month || !due?.day) return null;
  return `${due.year}-${String(due.month).padStart(2, '0')}-${String(due.day).padStart(2, '0')}`;
}

/**
 * Every submission on the class, or one person's.
 *
 * courseWorkId '-' is Classroom's wildcard: it answers for all the coursework
 * in the course at once. Asking per assignment would be one round trip per row
 * on the page, which for a term of work is slower than the whole rest of the
 * request put together.
 *
 * Capped rather than paged to exhaustion. Without a userId this is every
 * student times every assignment, so a large class multiplies fast. Six pages
 * is 600 submissions, well past anything here, and a class that somehow
 * exceeded it would lose the tail of a list rather than hang the request.
 */
async function listSubmissions(
  classroom: classroom_v1.Classroom,
  classId: string,
  userId?: string
): Promise<Submission[]> {
  const rows: Submission[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 6; page++) {
    const res = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: classId,
      courseWorkId: '-',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
      ...(userId ? { userId } : {}),
    });
    rows.push(...((res.data.studentSubmissions ?? []) as any[]).map(readSubmission));
    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return rows;
}

/** The class roster as Google id to name, so a submission can be given a face. */
async function fetchRoster(
  classroom: classroom_v1.Classroom,
  classId: string
): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const res = await classroom.courses.students.list({ courseId: classId, pageSize: 200 });
  const roster = new Map<string, { name: string; avatarUrl: string | null }>();
  for (const s of (res.data.students ?? []) as any[]) {
    const photo = s.profile?.photoUrl ?? null;
    roster.set(String(s.userId), {
      name: s.profile?.name?.fullName ?? 'Student',
      // Classroom returns these protocol relative, as //lh3.googleusercontent...
      avatarUrl: photo ? (photo.startsWith('//') ? `https:${photo}` : photo) : null,
    });
  }
  return roster;
}

/** A material's title and link, whichever of the kinds it is. */
function readMaterial(m: any): { title: string; link: string | null } {
  const inner = m?.driveFile?.driveFile ?? m?.youtubeVideo ?? m?.link ?? m?.form;
  return {
    title: inner?.title ?? inner?.url ?? 'Attachment',
    link: inner?.alternateLink ?? inner?.url ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const courseId: string | null = req.body?.courseId ?? null;
    // Previewing a class by URL, for the admin attaching one to a course. The
    // course may not exist yet, so there is no entitlement to check against and
    // no stored URL to read: the URL is the request.
    const previewUrl: string | null = req.body?.classroomUrl ?? null;
    if (!courseId && !previewUrl) {
      return res.status(400).json({ error: 'courseId or classroomUrl is required' });
    }

    let reader: Reader;
    let classUrl: string | null;

    if (previewUrl) {
      // Admins only, and deliberately stricter than the rest of this file. A
      // course id is checked against a relationship; a raw URL is not checked
      // against anything, so this would otherwise let any signed-in user read
      // any class the operations account can see.
      const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Not your course' });
      }
      reader = { kind: 'staff' };
      classUrl = previewUrl;
    } else {
      reader = await readerFor(db, user.id, courseId!);
      if (reader.kind === 'denied') {
        // Not "forbidden, and here is what exists". Somebody probing course ids
        // learns nothing either way.
        return res.status(403).json({ error: 'Not your course' });
      }

      const { data: course } = await db
        .from('courses')
        .select('google_classroom_url')
        .eq('id', courseId!)
        .maybeSingle();

      classUrl = course?.google_classroom_url ?? null;
    }

    if (!classUrl) return res.status(200).json({ assignments: [], topics: [], linked: false });

    const classId = courseIdFromUrl(classUrl);
    if (!classId) {
      return res.status(200).json({ assignments: [], topics: [], linked: true, invalidLink: true });
    }

    const classroom = classroomClient();
    // Work and topics together. Topics are the class's own grouping of the work
    // into units; a class that uses none returns an empty list and the reader
    // falls back to a flat list. A topics failure must not lose the assignments,
    // so it degrades to no grouping rather than failing the whole request.
    const [workRes, topicRes] = await Promise.all([
      classroom.courses.courseWork.list({ courseId: classId, pageSize: 100 }),
      classroom.courses.topics
        .list({ courseId: classId, pageSize: 100 })
        .catch(() => ({ data: { topic: [] } })),
    ]);

    const topics = (((topicRes as any)?.data?.topic ?? []) as any[]).map((t) => ({
      id: String(t.topicId),
      name: t.name ?? 'Untitled topic',
    }));

    const work = workRes.data.courseWork ?? [];

    // Who this reader is inside Classroom, needed only to decide what an
    // individually assigned piece of work is visible to.
    //
    // Classroom accepts an email address wherever it accepts a userId, so this
    // is one lookup rather than paging the whole roster. A learner who is not
    // a member of the class resolves to null, which the filter treats as
    // "prove it or hide it".
    let readerGoogleId: string | null = null;
    let membership: Membership | undefined;
    if (reader.kind === 'learner' && reader.email) {
      const state = await membershipOf(classroom, classId, reader.email);
      readerGoogleId = state.googleId;
      membership = state.membership;
    }

    const visibleTo = (w: any) => isVisibleTo(w, reader, readerGoogleId);

    // What has actually been handed in. A learner is asked about only
    // themselves, so Google filters it and no other student's row is ever in
    // the response to filter out here.
    //
    // Both of these degrade to nothing rather than failing the request. The
    // list of work is the point of the page; whether it has been turned in is
    // the useful extra, and losing the extra should not lose the point.
    let submissions: Submission[] = [];
    let roster = new Map<string, { name: string; avatarUrl: string | null }>();
    if (reader.kind === 'staff') {
      [submissions, roster] = await Promise.all([
        listSubmissions(classroom, classId).catch(() => []),
        fetchRoster(classroom, classId).catch(() => new Map()),
      ]);
    } else if (readerGoogleId) {
      submissions = await listSubmissions(classroom, classId, readerGoogleId).catch(() => []);
    }

    // A learner has at most one submission per assignment, so this is a lookup
    // rather than a list.
    const mine = new Map(submissions.map((s) => [s.courseWorkId, s]));

    // Published only. A draft is the teacher's business, and this endpoint
    // answers to students.
    const assignments = work
      .filter((w: any) => w.state === 'PUBLISHED')
      .filter(visibleTo)
      .map((w: any, i: number) => ({
        id: String(w.id),
        index: i + 1,
        title: w.title ?? 'Untitled',
        description: w.description ?? null,
        materials: (w.materials ?? []).map(readMaterial),
        dueDate: readDueDate(w.dueDate),
        maxPoints: typeof w.maxPoints === 'number' ? w.maxPoints : null,
        link: w.alternateLink ?? null,
        // The unit this work belongs to, matched to a topic id above. Null when
        // the teacher filed it under no topic.
        topicId: w.topicId ? String(w.topicId) : null,
        // This reader's own state. Undefined for staff, who are shown who
        // turned it in instead; a teacher has no submission of their own.
        isSubmitted: reader.kind === 'staff' ? undefined : !!mine.get(String(w.id))?.isSubmitted,
        grade: reader.kind === 'staff' ? undefined : mine.get(String(w.id))?.grade ?? null,
        late: reader.kind === 'staff' ? undefined : !!mine.get(String(w.id))?.late,
      }));

    // Only when the class has students. An empty roster means nobody has been
    // invited yet, and reporting "nobody has turned this in" for a class with
    // nobody in it says something about Yakal rather than about the students.
    const submitters =
      reader.kind === 'staff' && roster.size > 0
        ? submittersByWork(submissions, roster)
        : undefined;

    // classLink goes with membership: a Join button needs somewhere to go, and
    // the stored URL is the one the admin confirmed rather than one rebuilt
    // from an id.
    return res.status(200).json({
      assignments,
      topics,
      submitters,
      membership,
      classLink: membership && membership !== 'joined' ? classUrl : undefined,
      linked: true,
    });
  } catch (err: any) {
    console.error('classroom error:', err);
    const raw = err?.message || 'Server error';

    // invalid_grant means the operations account's refresh token is dead, and
    // Google gives the same answer whether it expired or was revoked. It is
    // worth translating: the raw string sends whoever reads it looking at the
    // request, and the request is fine. An OAuth app left in Testing expires
    // its refresh tokens after seven days, which is the usual reason.
    if (/invalid_grant/i.test(raw)) {
      return res.status(503).json({
        error:
          'Google access has expired. Re-run scripts/google-oauth-setup.mjs signed in ' +
          'as the account that owns the classes, and publish the OAuth consent screen ' +
          'so the token stops expiring weekly.',
      });
    }

    // The class exists for somebody, just not for this account.
    if (/not found|notFound/i.test(raw)) {
      return res.status(404).json({
        error:
          'That class was not found for the Yakal Google account. It is owned by a ' +
          'different account, or the link points at a class that no longer exists.',
      });
    }

    const status = raw.includes('session') || raw.includes('token') ? 401 : 500;
    return res.status(status).json({ error: raw });
  }
}
