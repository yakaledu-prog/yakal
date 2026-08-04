import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

import { getServiceClient, requireUser } from '../_utils/billing';

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

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
];

/**
 * The numeric class id inside a Classroom URL.
 *
 * The web app's /c/ segment is the numeric id in base64, but not always: an id
 * that does not decode to digits is already the id. Mirrors courseIdFromUrl in
 * src/services/classroomService.ts.
 */
function courseIdFromUrl(url: string): string | null {
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

function classroomClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('GOOGLE_OAUTH_REFRESH_TOKEN is not set');
  }
  const auth = new google.auth.OAuth2(
    process.env.VITE_GCP_CLIENT_ID,
    process.env.GCP_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: refreshToken, scope: SCOPES.join(' ') });
  return google.classroom({ version: 'v1', auth });
}

/**
 * Whether this user may read this course's work.
 *
 * Deliberately explicit rather than "is signed in". The four ways in are the
 * four relationships the product actually has to a course.
 */
async function mayRead(db: any, userId: string, courseId: string): Promise<boolean> {
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.role === 'admin') return true;

  // The tutor teaching it.
  const { data: course } = await db
    .from('courses')
    .select('tutor_id')
    .eq('id', courseId)
    .maybeSingle();
  if (course?.tutor_id && course.tutor_id === userId) return true;

  // A student enrolled on it.
  const { count: enrolled } = await db
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('student_id', userId);
  if ((enrolled ?? 0) > 0) return true;

  // A parent of a student enrolled on it. They paid for the course, and being
  // able to see what was set is most of what they paid for.
  const { data: links } = await db
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', userId)
    .eq('status', 'active');

  const childIds = (links ?? []).map((l: any) => l.student_id);
  if (childIds.length > 0) {
    const { count: childEnrolled } = await db
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .in('student_id', childIds);
    if ((childEnrolled ?? 0) > 0) return true;
  }

  return false;
}

/** Classroom sends a due date as three numbers, and omits it when there is none. */
function readDueDate(due: any): string | null {
  if (!due?.year || !due?.month || !due?.day) return null;
  return `${due.year}-${String(due.month).padStart(2, '0')}-${String(due.day).padStart(2, '0')}`;
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
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    if (!(await mayRead(db, user.id, courseId))) {
      // Not "forbidden, and here is what exists". Somebody probing course ids
      // learns nothing either way.
      return res.status(403).json({ error: 'Not your course' });
    }

    const { data: course } = await db
      .from('courses')
      .select('google_classroom_url')
      .eq('id', courseId)
      .maybeSingle();

    const classUrl = course?.google_classroom_url ?? null;
    if (!classUrl) return res.status(200).json({ assignments: [], linked: false });

    const classId = courseIdFromUrl(classUrl);
    if (!classId) {
      return res.status(200).json({ assignments: [], linked: true, invalidLink: true });
    }

    const classroom = classroomClient();
    const { data } = await classroom.courses.courseWork.list({
      courseId: classId,
      pageSize: 100,
    });

    const work = data.courseWork ?? [];

    // Published only. A draft is the teacher's business, and this endpoint
    // answers to students.
    const assignments = work
      .filter((w: any) => w.state === 'PUBLISHED')
      .map((w: any, i: number) => ({
        id: String(w.id),
        index: i + 1,
        title: w.title ?? 'Untitled',
        description: w.description ?? null,
        materials: (w.materials ?? []).map(readMaterial),
        dueDate: readDueDate(w.dueDate),
        maxPoints: typeof w.maxPoints === 'number' ? w.maxPoints : null,
        link: w.alternateLink ?? null,
      }));

    return res.status(200).json({ assignments, linked: true });
  } catch (err: any) {
    console.error('classroom error:', err);
    const message = err?.message || 'Server error';
    const status = message.includes('session') || message.includes('token') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
