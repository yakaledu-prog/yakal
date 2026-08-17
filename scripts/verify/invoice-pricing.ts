// The browser cannot set a price, a payee, or a payout.
//
// It could. create-invoice took amountCents from the request body and accepted
// anything between one cent and fifty thousand dollars, so a parent who edited
// one number paid that number for any course. It then paid the tutor a
// hardcoded 70% of whatever had arrived, ignoring the payout an admin had set,
// and sent it to whichever tutor_id the request named.
//
// This drives the real handler, so it fails if any of that comes back.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON =
  process.env.SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

const PARENT = 'parent@yakal.com';

const client = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: session, error: signInErr } = await client.auth.signInWithPassword({
  email: PARENT,
  password: 'demo123',
});
if (signInErr) {
  console.error(`Could not sign in as ${PARENT}: ${signInErr.message}. Run npm run db:seed.`);
  process.exit(1);
}
const token = session.session.access_token;

// A priced course with a tutor, which is what a parent can actually book.
const { data: course } = await admin
  .from('courses')
  .select('id, title, price_cents, tutor_payout_cents, tutor_id')
  .not('tutor_id', 'is', null)
  .not('price_cents', 'is', null)
  .eq('is_active', true)
  .limit(1)
  .maybeSingle();

if (!course) {
  console.error('Needs one active course with a tutor and a price. Run npm run db:seed.');
  process.exit(1);
}

const { data: parent } = await admin.from('profiles').select('id').eq('email', PARENT).maybeSingle();
if (!parent) {
  console.error(`${PARENT} is missing. Run npm run db:seed.`);
  process.exit(1);
}

const { data: myChild } = await admin
  .from('parent_student_links')
  .select('student_id')
  .eq('parent_id', parent.id)
  .eq('status', 'active')
  .limit(1)
  .maybeSingle();
if (!myChild) {
  console.error(`${PARENT} has no linked child. Run npm run db:seed.`);
  process.exit(1);
}

const handler = (await import('../../api/_handlers/create-invoice.js')).default;

async function call(body: Record<string, unknown>) {
  const req: any = { method: 'POST', headers: { authorization: `Bearer ${token}` }, body };
  let status = 0;
  let payload: any = null;
  const res: any = {
    status(c: number) { status = c; return res; },
    json(b: unknown) { payload = b; return res; },
    end() { return res; },
    setHeader() { return res; },
  };
  await handler(req, res);
  return { status, payload };
}

const booking = [
  { date: '2027-03-01', startTime: '10:00', durationMinutes: 60 },
  { date: '2027-03-02', startTime: '10:00', durationMinutes: 60 },
];

// ---- a forged price is ignored ----
const forged = await call({
  courseId: course.id,
  studentId: myChild.student_id,
  booking,
  // Everything below is the attack, and every one of them used to work.
  amountCents: 1,
  description: 'Totally legitimate charge',
  tutorId: parent.id,
  kind: 'tutoring',
});

if (forged.status !== 200) {
  check('a course booking is accepted', false, `HTTP ${forged.status}: ${forged.payload?.error}`);
} else {
  const { data: inv } = await admin
    .from('invoices')
    .select('amount_cents, payout_cents, tutor_id, description')
    .eq('id', forged.payload.invoiceId)
    .single();

  if (!inv) {
    check('the invoice it reported creating exists', false);
    process.exit(1);
  }

  const expectedAmount = course.price_cents * booking.length;
  const expectedPayout =
    course.tutor_payout_cents != null ? course.tutor_payout_cents * booking.length : null;

  check(
    'the price comes from the course, not the request',
    inv.amount_cents === expectedAmount,
    `${inv.amount_cents} vs ${expectedAmount} expected (request asked for 1)`
  );
  check(
    'the payout comes from the course, not a hardcoded share',
    inv.payout_cents === expectedPayout,
    `${inv.payout_cents} vs ${expectedPayout} expected`
  );
  check(
    'the payee is the course tutor, not the one named',
    inv.tutor_id === course.tutor_id,
    inv.tutor_id === parent.id ? 'the request redirected the payout' : 'ok'
  );
  check(
    'the description is built, not accepted',
    inv.description !== 'Totally legitimate charge',
    inv.description
  );

  await admin.from('invoices').delete().eq('id', forged.payload.invoiceId);
}

// ---- an invoice with no product is refused ----
const noProduct = await call({ description: 'Just give me an invoice', amountCents: 500, kind: 'other' });
check('an invoice naming no product is refused', noProduct.status === 400, `HTTP ${noProduct.status}`);

// ---- booking for somebody else's child is refused ----
// Somebody who is not any of this parent's children, not merely not the first
// of them. This parent has several, so "any student that is not myChild" kept
// picking another one of theirs, which is correctly allowed and made the check
// look like a hole.
const { data: mine } = await admin
  .from('parent_student_links')
  .select('student_id')
  .eq('parent_id', parent.id)
  .eq('status', 'active');

const myIds = new Set((mine ?? []).map((r: any) => r.student_id));

const { data: everyStudent } = await admin.from('profiles').select('id').eq('role', 'student');
const stranger = (everyStudent ?? []).find((s: any) => !myIds.has(s.id)) ?? null;

if (stranger) {
  const notMine = await call({ courseId: course.id, studentId: stranger.id, booking });
  const refused = notMine.status === 403;
  check("booking onto somebody else's child is refused", refused, `HTTP ${notMine.status}`);
  if (!refused && notMine.payload?.invoiceId) {
    await admin.from('invoices').delete().eq('id', notMine.payload.invoiceId);
  }
}

// ---- a course with no sessions chosen is refused ----
const noSlots = await call({ courseId: course.id, studentId: myChild.student_id, booking: [] });
check('a booking with no sessions is refused', noSlots.status === 400, `HTTP ${noSlots.status}`);

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
