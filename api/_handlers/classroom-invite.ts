import type { VercelRequest, VercelResponse } from '@vercel/node';
import { classroom_v1 } from '@googleapis/classroom';

import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { classroomClient, courseIdFromUrl, membershipOf, type Membership } from './classroom.js';

/**
 * Inviting a student to the Google class behind a course.
 *
 * Reading a class needs none of this: the server reads as the account that owns
 * it, so a student sees the coursework the moment their parent pays. An
 * invitation buys the two things reading cannot, which are their own submission
 * state showing in Yakal and the ability to turn work in.
 *
 * We cannot accept it for them. invitations.accept has to be called as the
 * invited person and we hold no student credentials, deliberately. So the most
 * this can do is send it without anybody remembering to, and put a button in
 * front of the student instead of an email they have to find.
 *
 * Needs classroom.rosters, not the readonly form. A token minted before that
 * scope was added answers "Request had insufficient authentication scopes".
 */

/** Who may invite somebody to a course's class. */
async function mayInvite(db: any, userId: string, courseId: string): Promise<boolean> {
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role === 'admin') return true;

  const { data: course } = await db
    .from('courses')
    .select('tutor_id')
    .eq('id', courseId)
    .maybeSingle();
  return !!course?.tutor_id && course.tutor_id === userId;
}

/**
 * Send one invitation, and report where the student now stands.
 *
 * Idempotent by checking first. Classroom rejects a duplicate invitation with
 * ALREADY_EXISTS, and an admin pressing a button twice should see "invited"
 * rather than an error about a state that is the one they wanted.
 */
export async function inviteToClass(
  classroom: classroom_v1.Classroom,
  classId: string,
  email: string
): Promise<{ membership: Membership; alreadyThere: boolean }> {
  const before = await membershipOf(classroom, classId, email);
  if (before.membership !== 'none') {
    return { membership: before.membership, alreadyThere: true };
  }

  await classroom.invitations.create({
    requestBody: { courseId: classId, userId: email, role: 'STUDENT' },
  });
  return { membership: 'invited', alreadyThere: false };
}

/**
 * Best effort, for the moment a purchase is fulfilled.
 *
 * Never throws. A Google outage, a dead refresh token or a missing scope must
 * not fail a payment that has already been taken, and the student has their
 * course either way: the admin's Students tab shows who still needs inviting,
 * and the button there is the retry.
 */
export async function inviteOnEnrolment(db: any, courseId: string, studentId: string): Promise<void> {
  try {
    const [{ data: course }, { data: student }] = await Promise.all([
      db.from('courses').select('google_classroom_url').eq('id', courseId).maybeSingle(),
      db.from('profiles').select('email').eq('id', studentId).maybeSingle(),
    ]);

    const classId = course?.google_classroom_url
      ? courseIdFromUrl(course.google_classroom_url)
      : null;
    if (!classId || !student?.email) return;

    await inviteToClass(classroomClient(), classId, student.email);
  } catch (err: any) {
    console.error('classroom invite on enrolment failed:', err?.message ?? err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const courseId: string | null = req.body?.courseId ?? null;
    const studentId: string | null = req.body?.studentId ?? null;
    if (!courseId || !studentId) {
      return res.status(400).json({ error: 'courseId and studentId are required' });
    }

    if (!(await mayInvite(db, user.id, courseId))) {
      return res.status(403).json({ error: 'Not your course' });
    }

    // Enrolled, not merely named. Otherwise this would invite anybody with an
    // id to a class their family has not paid for.
    const { count: enrolled } = await db
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .eq('status', 'active');
    if ((enrolled ?? 0) === 0) {
      return res.status(400).json({ error: 'That student is not enrolled on this course.' });
    }

    const [{ data: course }, { data: student }] = await Promise.all([
      db.from('courses').select('google_classroom_url').eq('id', courseId).maybeSingle(),
      db.from('profiles').select('email').eq('id', studentId).maybeSingle(),
    ]);

    const classUrl = course?.google_classroom_url ?? null;
    if (!classUrl) {
      return res.status(400).json({ error: 'This course has no Google Classroom attached.' });
    }
    const classId = courseIdFromUrl(classUrl);
    if (!classId) {
      return res.status(400).json({ error: 'That Google Classroom link is not a class URL.' });
    }
    if (!student?.email) {
      return res.status(400).json({ error: 'That student has no email address.' });
    }

    const result = await inviteToClass(classroomClient(), classId, student.email);
    return res.status(200).json({ ...result, email: student.email });
  } catch (err: any) {
    console.error('classroom-invite error:', err);
    const raw = err?.message || 'Server error';

    if (/insufficient authentication scopes/i.test(raw)) {
      return res.status(503).json({
        error:
          'Google will not let us send invitations yet. The refresh token needs the ' +
          'classroom.rosters scope: re-run scripts/google-oauth-setup.mjs.',
      });
    }
    if (/invalid_grant/i.test(raw)) {
      return res.status(503).json({ error: 'Google access has expired. Re-run scripts/google-oauth-setup.mjs.' });
    }
    // Classroom's own words are worth passing on here. "Requested entity was
    // not found" for an address that is not a Google account is the single
    // most likely failure, and it names the actual problem.
    return res.status(502).json({ error: raw });
  }
}
