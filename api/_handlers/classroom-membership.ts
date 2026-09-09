import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { classroomClient, courseIdFromUrl, membershipOf, type Membership } from './classroom.js';

/**
 * Where every enrolled student stands with a course's Google class.
 *
 * Its own endpoint rather than part of the coursework read, because that one
 * answers for whoever is asking and this answers about everybody else. A
 * student must never receive it.
 *
 * One Classroom call per student, to ask the only question Google answers
 * reliably: has this person joined. Whether an invitation is outstanding comes
 * from enrolments.classroom_invited_at, because invitations.list cannot be
 * filtered by email and returns invitations with no userId on them.
 *
 * Fine for a class of twenty, and capped so a mistake cannot turn one page load
 * into hundreds of requests.
 */
const MAX_STUDENTS = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const db = getServiceClient();

    const courseId: string | null = req.body?.courseId ?? null;
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    // Any tutor on the course counts as staff, not just the one who used to be
    // in courses.tutor_id. A course carries a roster now, and a tutor teaching
    // it who was not the column's value could not see its Classroom at all.
    const [{ data: profile }, { data: course }, { count: onRoster }] = await Promise.all([
      db.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      db.from('courses').select('google_classroom_url').eq('id', courseId).maybeSingle(),
      db
        .from('course_tutors')
        .select('tutor_id', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('tutor_id', user.id),
    ]);

    const isStaff = profile?.role === 'admin' || (onRoster ?? 0) > 0;
    if (!isStaff) return res.status(403).json({ error: 'Not your course' });

    const classUrl = course?.google_classroom_url ?? null;
    const classId = classUrl ? courseIdFromUrl(classUrl) : null;
    if (!classId) return res.status(200).json({ linked: false, students: [] });

    const { data: enrolled } = await db
      .from('enrolments')
      .select('student_id, classroom_invited_at, profiles!enrolments_student_id_fkey (id, email)')
      .eq('course_id', courseId)
      .eq('status', 'active')
      .limit(MAX_STUDENTS);

    const rows = (enrolled ?? []) as any[];
    const classroom = classroomClient();

    const students = await Promise.all(
      rows.map(async (r) => {
        const email: string | null = r.profiles?.email ?? null;
        if (!email) {
          return { studentId: r.student_id, email: null, membership: 'none' as Membership };
        }
        // One student's lookup failing must not blank the whole table. An
        // unknown state reads as "none", which offers Send invite: the worst
        // outcome is Classroom telling us they are already there, which
        // inviteToClass handles rather than erroring.
        const state = await membershipOf(classroom, classId, email, r.classroom_invited_at ?? null).catch(
          () => ({ membership: 'none' as Membership, googleId: null })
        );
        return { studentId: r.student_id, email, membership: state.membership };
      })
    );

    return res.status(200).json({ linked: true, students });
  } catch (err: any) {
    console.error('classroom-membership error:', err);
    const raw = err?.message || 'Server error';
    if (/invalid_grant/i.test(raw)) {
      return res.status(503).json({ error: 'Google access has expired. Re-run scripts/google-oauth-setup.mjs.' });
    }
    return res.status(502).json({ error: raw });
  }
}
