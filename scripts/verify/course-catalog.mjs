// The catalog on all three sides, and applying twice from the tutor page.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

psql('delete from course_applications;');
// Two courses with nobody on them, so the tutor has something to apply for.
psql("delete from course_tutors ct using courses c where ct.course_id = c.id and c.title in ('AP Subject Coaching','Biology, Foundations and Exam Practice');");

// What the parent catalog should hold: the active courses somebody teaches.
// Named and counted from the database rather than written in, because the two
// sides of this test pull in opposite directions. The courses emptied above
// are the ones the tutor page needs open, and they are exactly the ones the
// parent page must not show.
const bookableCount = Number(psql(
  "select count(*) from courses c where c.is_active and exists (select 1 from course_tutors ct where ct.course_id = c.id);"
));
const bookableTitle = psql(
  "select c.title from courses c where c.is_active and exists (select 1 from course_tutors ct where ct.course_id = c.id) order by c.title limit 1;"
);

const BASE = process.env.BASE || 'http://localhost:5173';
const S = '/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const b = await chromium.launch();
const errs = [];
let failures = 0;
const pass = (s, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`); };

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

// ---------- parent ----------
const parent = await signIn('parent@yakal.com');
await parent.goto(`${BASE}/parent/courses`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
const pText = await parent.locator('body').innerText();
pass('the parent catalog shows seeded courses', pText.includes(bookableTitle), bookableTitle);
// A course nobody teaches cannot be booked, so it must not be offered.
pass('a course with no tutor is not offered', !/AP Subject Coaching/.test(pText));
pass('it is paginating real rows', new RegExp(`of ${bookableCount}\\b`).test(pText),
  pText.match(/Showing [^\n]*/)?.[0] ?? '');
pass('no invented ratings or student counts', !/\d+ Students/.test(pText) && !/available tutors/i.test(pText));
await parent.screenshot({ path: `${S}/parent-catalog.png`, fullPage: true });

// A card must lead to a course that exists, not to CAT-01.
await parent.getByText(bookableTitle).first().click();
await parent.waitForTimeout(3500);
pass('a card opens the real course', (await parent.locator('body').innerText()).includes(bookableTitle));
pass('the booking page is not a dead end', !parent.url().includes('CAT-'), parent.url().split('/').pop());

// ---------- tutor ----------
const tutor = await signIn('tutor@yakal.com');
await tutor.goto(`${BASE}/tutor/find-courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(3500);
// Searched rather than read off the first page: the catalog paginates, and a
// tutor now sees every course they are not already on, so which ones land on
// page one is not something to assert.
await tutor.locator('input[placeholder="Search courses..."]').fill('AP Subject');
await tutor.waitForTimeout(1200);
pass('the tutor catalog lists open courses', /AP Subject Coaching/.test(await tutor.locator('body').innerText()));

// The bug this replaced: getOpenCourses filtered on tutor_id IS NULL, so the
// first accepted application removed a course from every other tutor's catalog
// for good. A course somebody already teaches is open to the rest.
await tutor.locator('input[placeholder="Search courses..."]').fill('K-12 English');
await tutor.waitForTimeout(1200);
pass('a course another tutor teaches is still open to apply for',
  /K-12 English Language Arts/.test(await tutor.locator('body').innerText()));
await tutor.locator('input[placeholder="Search courses..."]').fill('');
await tutor.waitForTimeout(1200);
const before = await tutor.getByRole('button', { name: 'Apply', exact: true }).count();
pass('there are courses to apply for', before > 0, `${before} apply buttons`);

await tutor.getByRole('button', { name: 'Apply', exact: true }).first().click();
await tutor.waitForTimeout(800);
// The dialog shows what the reviewer will see: the CV and the profile.
const dlg = tutor.locator('div[role="dialog"]');
pass('the dialog shows the resume card', await dlg.getByText(/Upload your resume|\.pdf|\.docx?/i).first().isVisible());
pass('it shows the tutor name', await dlg.getByText('Bethlehem Alemu').isVisible());
pass('it labels what gets sent', await dlg.getByText(/Sent with your application/i).isVisible());
pass('it labels the resume', await dlg.getByText(/from your onboarding/i).isVisible());
// The admin prices a course; a tutor does not quote for it.
pass('no rate is quoted', !/\/ hr/.test(await dlg.innerText()));
pass('the profile can be edited from here', await dlg.getByRole('link', { name: /Edit your profile/i }).isVisible());
await tutor.screenshot({ path: `${S}/tutor-apply-dialog.png` });
await tutor.getByRole('button', { name: /Send application/i }).click();
await tutor.waitForTimeout(3000);

pass('the application is stored', psql("select count(*) from course_applications where status='pending';") === '1');
const afterText = await tutor.locator('body').innerText();
// The bug: an applied course used to vanish, so the page looked like nothing
// had happened. It has to stay put and say so.
pass('the course stays in the catalog', !/Nothing open right now/.test(afterText));
pass('the card says it was applied for', /Applied/.test(afterText));
pass('one fewer apply button', (await tutor.getByRole('button', { name: 'Apply', exact: true }).count()) === before - 1);
await tutor.screenshot({ path: `${S}/tutor-after-apply.png`, fullPage: true });

// A second course can still be applied for.
await tutor.getByRole('button', { name: 'Apply', exact: true }).first().click();
await tutor.waitForTimeout(1000);
await tutor.getByRole('button', { name: /Send application/i }).click();
await tutor.waitForTimeout(3000);
pass('a second application works', psql("select count(*) from course_applications where status='pending';") === '2');

// ---------- admin ----------
const admin = await signIn('admin@yakal.com');
await admin.goto(`${BASE}/admin/courses`, { waitUntil: 'domcontentloaded' });
await admin.waitForTimeout(3000);
pass('the admin sees the seeded courses', /AP Subject Coaching/.test(await admin.locator('body').innerText()));

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
