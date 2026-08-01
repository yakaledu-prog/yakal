// The whole course flow, in order:
//   admin creates -> tutor applies -> admin accepts -> it reaches both sides
//   -> parent books real slots -> payment fulfils -> student and tutor see it
//
// Stripe's card form cannot be scripted, so checkout is intercepted and
// fulfilment is called with what the page actually sent. Everything either
// side of the card is ours and is where the bugs were.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

const BASE = process.env.BASE || 'http://localhost:5173';
const S = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let failures = 0;
const errs = [];
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

const TITLE = 'Flow Test, Organic Chemistry';
psql(`delete from courses where title = '${TITLE}';`);
psql('delete from course_applications;');
// Leftovers from other suites would make the notification count wrong.
psql("delete from notifications where type='enrolment';");
await fetch('http://127.0.0.1:54324/api/v1/messages', { method: 'DELETE' });

const b = await chromium.launch();
async function signIn(email) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('pageerror', e => errs.push(`${email}: ${e.message}`));
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.locator('input[type="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
  return p;
}

// ---------- 1. an admin creates an unassigned course ----------
const db = createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } });
const { data: course } = await db.from('courses').insert({
  title: TITLE, subject: 'Chemistry', description: 'Reaction mechanisms and organic synthesis.',
  price_cents: 7000, tutor_payout_cents: 4900, is_active: true,
}).select('id').single();
pass('1. an unassigned course exists', !!course?.id);

// ---------- 2. it is hidden from parents, offered to tutors ----------
const parent = await signIn('parent@yakal.com');
await parent.goto(`${BASE}/parent/courses`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
pass('2. a tutorless course is not on the parent catalog', !(await parent.locator('body').innerText()).includes(TITLE));

const tutor = await signIn('tutor@yakal.com');
await tutor.goto(`${BASE}/tutor/find-courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(3500);
pass('3. the tutor is offered it', (await tutor.locator('body').innerText()).includes(TITLE));

// ---------- 3. the tutor applies ----------
const card = tutor.locator('article').filter({ hasText: TITLE }).first();
await card.getByRole('button', { name: 'Apply', exact: true }).click();
await tutor.waitForTimeout(900);
await tutor.getByRole('button', { name: /Send application/i }).click();
await tutor.waitForTimeout(2500);
pass('4. the application is filed', psql(`select count(*) from course_applications where course_id='${course.id}' and status='pending';`) === '1');

// ---------- 4. the admin accepts ----------
const admin = await signIn('admin@yakal.com');
await admin.goto(`${BASE}/admin/courses/${course.id}`, { waitUntil: 'domcontentloaded' });
await admin.waitForTimeout(3500);
pass('5. the applicant is shown to the admin', (await admin.locator('body').innerText()).includes('Bethlehem Alemu'));
await admin.getByRole('button', { name: /Accept and assign/i }).click();
await admin.waitForTimeout(3000);
pass('6. the tutor is assigned', psql(`select tutor_id is not null from courses where id='${course.id}';`) === 't');

// ---------- 5. it reaches both sides ----------
await tutor.goto(`${BASE}/tutor/courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(3500);
pass('7. it is on the tutor My Courses', (await tutor.locator('body').innerText()).includes(TITLE));

await parent.goto(`${BASE}/parent/courses`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
pass('8. it is now on the parent catalog', (await parent.locator('body').innerText()).includes(TITLE));

// ---------- 6. the parent books ----------
let posted = null;
await parent.route('**/api/create-invoice', async (route) => {
  posted = route.request().postDataJSON();
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invoiceId: 'test' }) });
});
await parent.route('**/api/stripe-checkout', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: null }) }));

await parent.goto(`${BASE}/parent/courses/${course.id}`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(4000);
pass('9. the assigned tutor is shown', (await parent.locator('body').innerText()).includes('Bethlehem Alemu'));

// The grid must match the tutor's own calendar: 8 AM through 8 PM.
const slotLabels = await parent.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s(AM|PM)$/ }).allInnerTexts();
pass('10. no slot earlier than the tutor offers', !slotLabels.includes('7:00 AM'), slotLabels[0] ?? 'none');

// A time that has gone is not drawn at all, so nothing in the grid is inert.
const slotButtons = parent.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s(AM|PM)$/ });
const inert = await parent.locator('button[disabled]').filter({ hasText: /^\d{1,2}:\d{2}\s(AM|PM)$/ }).count();
pass('11. no past slot is offered', inert === 0, `${inert} inert of ${await slotButtons.count()}`);

await parent.getByRole('button', { name: 'Next week' }).or(parent.locator('button.h-8.w-8').last()).click();
await parent.waitForTimeout(1200);
const free = parent.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}:\d{2}\s(AM|PM)$/ }).first();
await free.waitFor({ timeout: 15000 });
const chosen = (await free.innerText()).trim();
await free.click();
await parent.waitForTimeout(700);
await parent.getByRole('button', { name: /^Checkout/i }).first().click();
await parent.waitForTimeout(2500);

pass('12. checkout gets the course, child and tutor',
  posted?.courseId === course.id && !!posted?.studentId && !!posted?.tutorId);
pass('13. the booked time matches what was clicked',
  posted?.booking?.[0]?.startTime === `${String(parseInt(chosen) + (/PM/.test(chosen) && !chosen.startsWith('12') ? 12 : 0)).padStart(2, '0')}:00`,
  `${chosen} -> ${posted?.booking?.[0]?.startTime}`);
pass('14. the booked date is in the future',
  posted?.booking?.[0]?.date >= new Date().toISOString().slice(0, 10), posted?.booking?.[0]?.date ?? 'none');
pass('15. the price comes from the course', posted?.amountCents === 7000 * posted?.booking?.length, String(posted?.amountCents));
await parent.screenshot({ path: `${S}/flow-booking.png`, fullPage: true });

// ---------- 7. payment fulfils ----------
const { data: invoice } = await db.from('invoices').insert({
  parent_id: posted.studentId ? psql("select id from profiles where email='parent@yakal.com';") : null,
  student_id: posted.studentId, tutor_id: posted.tutorId, course_id: posted.courseId,
  booking: posted.booking, description: posted.description, amount_cents: posted.amountCents,
  payout_cents: 4900, kind: 'tutoring', status: 'paid', payout_status: 'pending',
}).select('id').single();
const { fulfilInvoices } = await import('../../api/utils/fulfil.ts');
await fulfilInvoices(db, [invoice.id]);

pass('16. the student is enrolled', psql(`select count(*) from enrolments where course_id='${course.id}';`) === '1');
pass('17. the booked slot became a session', psql(`select count(*) from sessions where course_id='${course.id}';`) === String(posted.booking.length));
pass('18. everyone is notified', psql(`select count(*) from notifications where type='enrolment';`) === '3');
const mail = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
pass('19. the emails go out', mail.total === 3, `total=${mail.total}`);
pass('20. the tutor payout is pending for the admin', psql(`select payout_status from invoices where id='${invoice.id}';`) === 'pending');

// ---------- 8. it reaches the student, and the student reaches the tutor ----------
const student = await signIn('student@yakal.com');
await student.goto(`${BASE}/student/my-learning`, { waitUntil: 'domcontentloaded' });
await student.waitForTimeout(4000);
pass('21. the course is on the student side', (await student.locator('body').innerText()).includes(TITLE));
await student.screenshot({ path: `${S}/flow-student.png`, fullPage: true });

await tutor.goto(`${BASE}/tutor/students`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(4000);
pass('22. the student is on the tutor side', (await tutor.locator('body').innerText()).includes('Amen Worku'));

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nthe whole flow works' : `\n${failures} step(s) failed`);
process.exit(failures === 0 ? 0 : 1);
