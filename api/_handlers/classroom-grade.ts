import type { VercelRequest, VercelResponse } from '@vercel/node';
// Slim client only. See the note in classroom.ts about the 204 MB full package.
import { classroom_v1, auth as googleAuth } from '@googleapis/classroom';

import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { classroomSubmissionFor } from '../_utils/classroom-grade-target.js';

// ============================================================
// Write a grade a tutor gave in Yakal back to Google Classroom (P4).
//
// Grading is native (a tutor marks work in Yakal); this mirrors the result out
// to the linked class for the tutors who also keep a Classroom gradebook. It is
// best-effort: the native grade is the record, so a class that is not linked, a
// student who is not a class member, or a missing write scope is reported, not
// an error that loses the grade.
//
// Authorisation is the same shape as the read-through: only the course's tutor
// or an admin may push a grade, checked against the database before Google is
// touched. The operations account does the write, so no student or tutor signs
// into Google.
// ============================================================

/** Mirrors courseIdFromUrl in classroom.ts and classroomService.ts. */
function courseIdFromUrl(url: string): string | null {
  const match = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    if (/^\d+$/.test(decoded)) return decoded;
  } catch {
    // Not base64; some links carry the raw id already.
  }
  return match[1];
}

function classroomClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('GOOGLE_OAUTH_REFRESH_TOKEN is not set');
  const auth = new googleAuth.OAuth2(
    process.env.VITE_GCP_CLIENT_ID,
    process.env.GCP_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return new classroom_v1.Classroom({ auth });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const submissionId: string | null = req.body?.submissionId ?? null;
    if (!submissionId) return res.status(400).json({ error: 'submissionId is required' });

    // The grade and the work it belongs to.
    const { data: submission } = await db
      .from('submissions')
      .select('id, grade, student_id, assignment_id')
      .eq('id', submissionId)
      .maybeSingle();
    if (!submission) return res.status(404).json({ error: 'No such submission' });
    if (submission.grade == null) {
      return res.status(200).json({ written: false, reason: 'not graded yet' });
    }

    const { data: assignment } = await db
      .from('assignments')
      .select('external_id, course_id')
      .eq('id', submission.assignment_id)
      .maybeSingle();
    if (!assignment?.external_id) {
      // A Yakal-authored assignment has no Classroom courseWork to grade.
      return res.status(200).json({ written: false, reason: 'not a Classroom assignment' });
    }

    const { data: course } = await db
      .from('courses')
      .select('google_classroom_url, tutor_id')
      .eq('id', assignment.course_id)
      .maybeSingle();

    // Only the course's tutor or an admin may push a grade.
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const isTutor = course?.tutor_id === user.id;
    if (profile?.role !== 'admin' && !isTutor) {
      return res.status(403).json({ error: 'Not your course' });
    }

    const classUrl = course?.google_classroom_url ?? null;
    const classId = classUrl ? courseIdFromUrl(classUrl) : null;
    if (!classId) return res.status(200).json({ written: false, reason: 'course not linked to a class' });

    const { data: student } = await db
      .from('profiles')
      .select('email')
      .eq('id', submission.student_id)
      .maybeSingle();

    const classroom = classroomClient();

    // Who is on the class, and their submissions for this piece of work.
    const [rosterRes, subsRes] = await Promise.all([
      classroom.courses.students.list({ courseId: classId, pageSize: 200 }),
      classroom.courses.courseWork.studentSubmissions.list({
        courseId: classId,
        courseWorkId: assignment.external_id,
        pageSize: 200,
      }),
    ]);

    const roster = (rosterRes.data.students ?? []).map((s: any) => ({
      userId: String(s.userId),
      email: s.profile?.emailAddress ?? null,
    }));
    const remoteSubmissions = (subsRes.data.studentSubmissions ?? []).map((s: any) => ({
      id: String(s.id),
      userId: String(s.userId),
    }));

    const targetId = classroomSubmissionFor(student?.email ?? null, roster, remoteSubmissions);
    if (!targetId) {
      // The usual case under the no-sign-in model: the student is not a member of
      // the Google class, so there is no submission to write to. The native grade
      // stands on its own.
      return res.status(200).json({ written: false, reason: 'student not on the Classroom roster' });
    }

    const grade = Number(submission.grade);
    await classroom.courses.courseWork.studentSubmissions.patch({
      courseId: classId,
      courseWorkId: assignment.external_id,
      id: targetId,
      updateMask: 'assignedGrade,draftGrade',
      requestBody: { assignedGrade: grade, draftGrade: grade },
    });
    // Publish it to the student. Best-effort: the grade is already recorded on
    // the submission above, and returning is a courtesy on top.
    try {
      await classroom.courses.courseWork.studentSubmissions.return({
        courseId: classId,
        courseWorkId: assignment.external_id,
        id: targetId,
        requestBody: {},
      });
    } catch (returnErr: any) {
      console.error('classroom-grade: could not return the submission:', returnErr?.message);
    }

    return res.status(200).json({ written: true });
  } catch (err: any) {
    const raw = err?.message || 'Server error';
    console.error('classroom-grade error:', raw);

    if (/invalid_grant/i.test(raw)) {
      return res.status(503).json({
        error:
          'Google access has expired. Re-run scripts/google-oauth-setup.mjs and publish the ' +
          'OAuth consent screen so the token stops expiring weekly.',
      });
    }
    // The read-through token may not carry the write scope. Say so plainly
    // rather than failing the tutor's action - the native grade is safe.
    if (/insufficient|permission|forbidden|scope/i.test(raw)) {
      return res.status(200).json({
        written: false,
        reason:
          'The Yakal Google account cannot write grades to this class. Re-mint the token with the ' +
          'classroom.coursework.students scope (scripts/google-oauth-setup.mjs).',
      });
    }
    return res.status(500).json({ error: raw });
  }
}
