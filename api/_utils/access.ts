import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from './supabase.js';

// ============================================================
// Who may act for a student, asked on the server.
//
// The Drive and Zoom handlers took a studentId, a role and an email from the
// request body and trusted all three, so anybody on the internet could read a
// student's transcripts or take host control of their lesson. This answers the
// question from the database instead: the caller comes from their token, the
// relationship from the rows.
//
// The assigned-counsellor check is is_my_advisee written out with an explicit
// caller, because the service client has no auth.uid() for the SQL helper to
// read. A parent counts only through an active link, which Phase 1 made
// something a parent can no longer grant themselves.
// ============================================================

export type StudentAccess = 'self' | 'parent' | 'counselor' | 'admin';

/**
 * The signed-in caller, or null.
 *
 * requireUser throws, and _dispatch turns a thrown error into a 500, which
 * authedPost does not treat as a session problem: no refresh, no retry, and
 * the page says "failed" instead of asking the person to sign in. So handlers
 * catch it here and answer 401 themselves.
 */
export async function callerOrNull(req: any): Promise<{ id: string; email: string | null } | null> {
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

export async function studentAccess(
  db: SupabaseClient,
  callerId: string,
  studentId: string | null | undefined
): Promise<StudentAccess | null> {
  if (!studentId) return null;
  if (callerId === studentId) return 'self';

  const { data: me } = await db.from('profiles').select('role').eq('id', callerId).maybeSingle();
  if (me?.role === 'admin') return 'admin';

  if (me?.role === 'parent') {
    const { count } = await db
      .from('parent_student_links')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', callerId)
      .eq('student_id', studentId)
      .eq('status', 'active');
    return (count ?? 0) > 0 ? 'parent' : null;
  }

  if (me?.role === 'counselor') {
    const { count } = await db
      .from('admissions_plans')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('counselor_id', callerId)
      .in('status', ['active', 'past_due']);
    return (count ?? 0) > 0 ? 'counselor' : null;
  }

  return null;
}

/**
 * The assigned counsellor's email, for sharing an essay with them.
 *
 * Looked up rather than taken from the request: an endpoint that shares a
 * student's document with whatever address it is handed is a way to give
 * anybody a copy.
 */
export async function assignedCounselorEmail(
  db: SupabaseClient,
  studentId: string
): Promise<string | null> {
  const { data: plan } = await db
    .from('admissions_plans')
    .select('counselor_id')
    .eq('student_id', studentId)
    .in('status', ['active', 'past_due'])
    .not('counselor_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!plan?.counselor_id) return null;
  const { data: c } = await db.from('profiles').select('email').eq('id', plan.counselor_id).maybeSingle();
  return c?.email ?? null;
}

/**
 * How the caller relates to a session, as reschedule_session defines it.
 *
 * The tutor is whoever the session names, which for an advising hour is the
 * counsellor. A parent counts only through an active link to the student.
 */
export async function sessionRole(
  db: SupabaseClient,
  callerId: string,
  session: { tutor_id: string; student_id: string }
): Promise<'tutor' | 'student' | 'parent' | 'admin' | null> {
  if (session.tutor_id === callerId) return 'tutor';
  if (session.student_id === callerId) return 'student';
  const access = await studentAccess(db, callerId, session.student_id);
  if (access === 'parent') return 'parent';
  if (access === 'admin') return 'admin';
  return null;
}
