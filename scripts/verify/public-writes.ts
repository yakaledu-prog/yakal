// The blog, the contact inbox and notifications answer only to the right people.
//
// All three were open: anybody could write or delete blog posts and read the
// drafts; any signed-in user could read every contact form submission; and any
// signed-in user could send any notification, with any link, to anybody, which
// the email half then mailed out from Yakal's address.
//
// Needs the local Supabase and the seeded accounts (parent@ is linked to
// student@, and counselor@ has a plan with student@). Removes what it writes.
// Never sends an email: the one notify-email call it makes is one that must be
// refused before anything is sent.

import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON =
  process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const opts = { auth: { persistSession: false } };
const db = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

async function as(email: string) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return { c, id: data.user!.id, token: data.session!.access_token };
}

const MARK = `verify-public-writes-${Date.now()}`;
const [admin, parent, student, student2, counselor] = await Promise.all(
  ['admin@yakal.com', 'parent@yakal.com', 'student@yakal.com', 'student2@yakal.com', 'counselor@yakal.com'].map(as)
);

const note = (userId: string, template: string | null, extra: Record<string, unknown> = {}) => ({
  user_id: userId,
  type: 'system',
  title: MARK,
  message: MARK,
  template,
  vars: {},
  ...extra,
});

try {
  // ---- Blog ----
  let r: { error: { message: string } | null; data?: any } = await anon.from('blog_posts').insert({ title: MARK, content: 'x', status: 'published' }).select('id');
  pass('a visitor cannot write a blog post', !!r.error, r.error?.message ?? 'inserted');

  r = await student.c.from('blog_posts').insert({ title: MARK, content: 'x', status: 'published' }).select('id');
  pass('nor can a signed-in student', !!r.error, r.error?.message ?? 'inserted');

  const { data: draft }: { data: any } = await db.from('blog_posts').insert({ title: MARK, content: 'draft', status: 'draft' }).select('id').single();
  r = await anon.from('blog_posts').select('id').eq('id', draft.id);
  pass('a draft is invisible to the public', (r.data ?? []).length === 0);

  r = await anon.from('blog_posts').update({ title: 'defaced' }).eq('id', draft.id).select('id');
  pass('a visitor cannot rewrite a post', !!r.error || (r.data ?? []).length === 0, r.error?.message ?? '');
  r = await anon.from('blog_posts').delete().eq('id', draft.id).select('id');
  const stillThere = (await db.from('blog_posts').select('id').eq('id', draft.id)).data?.length === 1;
  pass('or delete one', stillThere, r.error?.message ?? '');

  r = await admin.c.from('blog_posts').select('id').eq('id', draft.id);
  pass('an admin sees drafts', (r.data ?? []).length === 1);
  r = await admin.c.from('blog_posts').update({ status: 'published' }).eq('id', draft.id).select('id');
  pass('and can publish one', !r.error && (r.data ?? []).length === 1, r.error?.message);
  r = await anon.from('blog_posts').select('id').eq('id', draft.id);
  pass('which the public then sees', (r.data ?? []).length === 1);
  r = await admin.c.from('blog_posts').delete().eq('id', draft.id).select('id');
  pass('and an admin can delete it', !r.error && (r.data ?? []).length === 1, r.error?.message);

  // ---- Contact inbox ----
  r = await anon.from('contact_messages').insert({ first_name: MARK, last_name: 'Check', email: 'x@example.test', message: 'x' });
  pass('a visitor cannot write to the inbox directly', !!r.error, r.error?.message ?? 'inserted');

  const { data: msg }: { data: any } = await db.from('contact_messages').insert({ first_name: MARK, last_name: 'Check', email: 'x@example.test', message: 'hello' }).select('id').single();
  r = await student.c.from('contact_messages').select('id').eq('id', msg.id);
  pass("a student cannot read visitors' messages", (r.data ?? []).length === 0);
  r = await admin.c.from('contact_messages').select('id, status').eq('id', msg.id);
  pass('an admin can, and it starts unread', r.data?.[0]?.status === 'unread', r.error?.message);
  r = await admin.c.from('contact_messages').update({ status: 'handled' }).eq('id', msg.id).select('status');
  pass('and marking it handled now actually saves', r.data?.[0]?.status === 'handled', r.error?.message ?? 'no row changed');
  await db.from('contact_messages').delete().eq('id', msg.id);

  // ---- Notifications: who may send what to whom ----
  // No .select() after these inserts: the sender cannot read a row addressed to
  // somebody else, and PostgREST reports that RETURNING as an RLS failure. The
  // app never reads its sends back either. The service client checks instead.
  const sentBy = async () =>
    (await db.from('notifications').select('created_by').eq('title', MARK).eq('user_id', parent.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.created_by;

  r = await student.c.from('notifications').insert(note(parent.id, 'unlockRequest'));
  pass('a student can ask their linked parent', !r.error, r.error?.message);
  pass('and the row records who sent it', (await sentBy()) === student.id);

  r = await student.c.from('notifications').insert(note(parent.id, 'unlockRequest', { created_by: admin.id }));
  pass('a forged sender is overwritten', !r.error && (await sentBy()) === student.id, r.error?.message);

  r = await student2.c.from('notifications').insert(note(parent.id, 'unlockRequest'));
  pass("another student cannot send to somebody else's parent", !!r.error, r.error?.message ?? 'inserted');

  r = await parent.c.from('notifications').insert(note(student.id, null));
  pass('a row with no template is refused', !!r.error, r.error?.message ?? 'inserted');
  r = await parent.c.from('notifications').insert(note(student.id, 'system'));
  pass('as is a template the browser never sends', !!r.error, r.error?.message ?? 'inserted');
  r = await parent.c.from('notifications').insert(note(student.id, 'accountApproved'));
  pass('a parent cannot send an admin-only template', !!r.error, r.error?.message ?? 'inserted');

  r = await student.c.from('notifications').insert(note(parent.id, 'unlockRequest', { link: '//evil.example/login' }));
  pass('an allowed send with an off-site link is refused', !!r.error, r.error?.message ?? 'inserted');
  r = await student.c.from('notifications').insert(note(parent.id, 'unlockRequest', { link: '/\\evil.example' }));
  pass('including the backslash form', !!r.error, r.error?.message ?? 'inserted');

  r = await counselor.c.from('notifications').insert(note(student.id, 'essayReview'));
  pass('a counsellor can tell their own advisee', !r.error, r.error?.message);
  // Not student2 by name: a reseed can put any student on this counsellor's
  // books, and then "somebody else's student" is not somebody else's at all.
  const advisees: any[] = (await db.from('admissions_plans').select('student_id')
    .eq('counselor_id', counselor.id).in('status', ['active', 'past_due'])).data ?? [];
  const students: any[] = (await db.from('profiles').select('id').eq('role', 'student')).data ?? [];
  const stranger = students.map((x) => x.id).find((id) => !advisees.some((a) => a.student_id === id));
  if (stranger) {
    r = await counselor.c.from('notifications').insert(note(stranger, 'essayReview'));
    pass("but not somebody else's student", !!r.error, r.error?.message ?? 'inserted');
  } else {
    console.log('skip  this counsellor advises every student, so there is no stranger to try');
  }

  r = await admin.c.from('notifications').insert(note(student.id, 'accountApproved'));
  pass('an admin can send an admin template', !r.error, r.error?.message);

  // sessionMoved: a real session pair, whoever the seed happens to have.
  const { data: s } = await db.from('sessions').select('tutor_id, student_id').limit(1).maybeSingle();
  if (s) {
    const emails = Object.fromEntries(
      ((await db.from('profiles').select('id, email').in('id', [s.tutor_id, s.student_id])).data ?? []).map((p: any) => [p.id, p.email])
    );
    const tutor = await as(emails[s.tutor_id]);
    r = await tutor.c.from('notifications').insert(note(s.student_id, 'sessionMoved'));
    pass("a tutor can tell their session's student it moved", !r.error, r.error?.message);
    const stranger = s.student_id === student2.id ? student : student2;
    const shares = (await db.from('sessions').select('id').eq('tutor_id', s.tutor_id).eq('student_id', stranger.id)).data?.length;
    if (!shares) {
      r = await stranger.c.from('notifications').insert(note(s.tutor_id, 'sessionMoved'));
      pass('a stranger cannot tell that tutor a session moved', !!r.error, r.error?.message ?? 'inserted');
    }
  } else {
    console.log('skip  no seeded session, so the sessionMoved checks did not run');
  }

  // ---- A recipient can only mark read or archive ----
  const { data: mine }: { data: any } = await db.from('notifications').select('id').eq('title', MARK).eq('user_id', parent.id).limit(1).single();
  r = await parent.c.from('notifications').update({ link: '//evil.example' }).eq('id', mine.id).select('id');
  pass("a recipient cannot rewrite a row's link", !!r.error, r.error?.message ?? 'updated');
  r = await parent.c.from('notifications').update({ title: 'From Yakal: pay here' }).eq('id', mine.id).select('id');
  pass('or its title', !!r.error, r.error?.message ?? 'updated');
  r = await parent.c.from('notifications').update({ is_read: true, archived: true }).eq('id', mine.id).select('id');
  pass('but can mark it read and archive it', !r.error && (r.data ?? []).length === 1, r.error?.message);

  // ---- The email half sends only for the caller's own row ----
  const emailHandler = (await import('../../api/_handlers/notify-email.js')).default;
  const out: { code?: number; body?: unknown } = {};
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: unknown) { out.body = b; return res; },
    end() { return res; },
  };
  await emailHandler(
    { method: 'POST', headers: { authorization: `Bearer ${student2.token}` }, body: { userId: parent.id, template: 'unlockRequest' } } as any,
    res
  );
  pass("nobody can have somebody else's notification emailed", out.code === 403, `${out.code}`);
} finally {
  await db.from('notifications').delete().eq('title', MARK);
  await db.from('blog_posts').delete().eq('title', MARK);
  await db.from('contact_messages').delete().eq('first_name', MARK);
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);

export {};
