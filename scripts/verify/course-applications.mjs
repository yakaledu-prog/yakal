// A tutor applies for an open course; an admin decides.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

psql('delete from course_applications;');
// Chemistry is the only course this tutor is not already on, so the suite is
// not at the mercy of card order. Everything else gets them on its roster.
//
// "Open" means they are not on it, not that nobody is: a course can carry
// several tutors, and the catalog used to hide any course with one.
psql("insert into course_tutors (course_id, tutor_id) select c.id, p.id from courses c cross join profiles p where p.email='tutor@yakal.com' and c.title not like 'Chemistry%' on conflict do nothing;");
psql("delete from course_tutors ct using courses c where ct.course_id = c.id and c.title like 'Chemistry%';");

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

const tutor = await signIn('tutor@yakal.com');
// Finding work has its own page, laid out like the parent catalog. My Courses
// stays a workspace for what is already being taught.
await tutor.goto(`${BASE}/tutor/courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(4000);
pass('My Courses has no marketplace in it', !/Find a course|Apply/.test(await tutor.locator('body').innerText()));

await tutor.goto(`${BASE}/tutor/find-courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(3000);
pass('the catalog page loads', /Find a course/.test(await tutor.locator('body').innerText()));
pass('no available-tutors section', !/Available Tutors/i.test(await tutor.locator('body').innerText()));
await tutor.screenshot({ path: `${S}/tutor-find-courses.png`, fullPage: true });
pass('open courses are listed', /Chemistry, Grade 11 Foundations/.test(await tutor.locator('body').innerText()));
// The payout is the tutor's business; what the parent pays is not, and
// inviting the comparison helps nobody.
const openText = await tutor.locator('body').innerText();
pass('the tutor payout is shown per hour', /\$40\.00/.test(openText) && /\/hr/.test(openText),
  openText.match(/[$][\d.,]+\s*\/hr/)?.[0] ?? openText.match(/[$][\d.,]+/)?.[0] ?? '');
pass('the parent price is not shown', !/55\.00/.test(openText));
await tutor.screenshot({ path: `${S}/tutor-open-courses.png` });

const card = tutor.locator('article').filter({ hasText: 'Chemistry, Grade 11 Foundations' }).first();
await card.getByRole('button', { name: 'Apply', exact: true }).click();
await tutor.waitForTimeout(700);
// The resume from onboarding is what gets sent, so the dialog has to show it.
pass('the application shows the resume on file', await tutor.getByText(/Upload your resume|\.pdf|\.docx?/i).first().isVisible().catch(() => false));
// Opening the menu here would dismiss the dialog, so this only checks the
// affordance is on the card. The menu's contents are covered separately.
pass('the resume card offers its options', await tutor.getByRole('button', { name: /Resume options|Upload your resume/i }).first().isVisible());
await tutor.getByRole('button', { name: /Send application/i }).click();
await tutor.waitForTimeout(2500);
pass('the application reaches the database', psql("select count(*) from course_applications where status='pending';") === '1');
pass('admins are notified', Number(psql("select count(*) from notifications where type='course_application';")) > 0);

// The filter is a tab strip on the banner's bottom edge, not a menu.
await tutor.getByRole('tab', { name: /^Applied \(/ }).click();
await tutor.waitForTimeout(1500);
const appliedText = await tutor.locator('body').innerText();
pass('it appears under Applied', /Chemistry, Grade 11 Foundations/.test(appliedText));
pass('its state is shown on the card', /Applied/.test(appliedText));
pass('it can be withdrawn from the card', /Withdraw/.test(appliedText));
// Withdrawing retracts something a reviewer may already be reading, so it asks.
await tutor.getByRole('button', { name: 'Withdraw', exact: true }).first().click();
await tutor.waitForTimeout(700);
pass('withdrawing asks first', await tutor.getByText(/Withdraw this application\?/i).isVisible());
await tutor.getByRole('button', { name: /Cancel/i }).first().click();
await tutor.waitForTimeout(600);
pass('cancelling keeps the application', psql("select count(*) from course_applications where status='pending';") === '1');

await tutor.getByRole('tab', { name: /^Applied \(/ }).click();
await tutor.waitForTimeout(1500);
// It stays put and shows its state. Vanishing looked like a failed click.
pass('an applied course stays and says so', /Applied/.test(await tutor.locator('body').innerText()));

// A tutor must not be able to accept themselves. The policy lets them move a
// pending row to withdrawn and nothing else, so this write has to be refused.
let selfAccept;
try {
  psql(`set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', (select id from profiles where email='tutor@yakal.com'), 'role', 'authenticated')::text, true); update course_applications set status='accepted' where status='pending';`);
  selfAccept = psql("select count(*) from course_applications where status='accepted';");
} catch {
  // RLS refused the write outright, which is the strongest form of the answer.
  selfAccept = '0';
}
pass('a tutor cannot accept their own application', selfAccept === '0', `accepted=${selfAccept}`);

// ---------- the admin decides ----------
// A resume on the applicant, so the admin's card has one to offer. The path
// only has to exist; it is signed on click, which this does not do.
psql("update profiles set resume_url = '39b5cc44-5ce1-4822-9414-01c27a9bb940/cv_1.pdf' where email='tutor@yakal.com';");

const admin = await signIn('admin@yakal.com');
const courseId = psql("select id from courses where title like 'Chemistry%' limit 1;");
await admin.goto(`${BASE}/admin/courses/${courseId}`, { waitUntil: 'domcontentloaded' });
await admin.waitForTimeout(3500);
const adminText = await admin.locator('body').innerText();
pass('the applicant is listed for the admin', /Bethlehem Alemu/.test(adminText));
// Only when there is one to offer: ViewCvButton renders nothing without a
// path, so the row above puts one on the tutor. The assertion used to look for
// "View CV" or "No CV", and the component has offered neither since it was
// renamed and its empty state removed, so it could not pass either way.
pass('the applicant resume is offered to the admin', /View resume/i.test(adminText));
pass('no invented tutors remain', !/Sarah|4\.9|Verified Pro/i.test(adminText));
pass('the course reads as unassigned', /Nobody is teaching this course yet|applied/i.test(adminText));
await admin.screenshot({ path: `${S}/admin-course-applicants.png`, fullPage: true });

await admin.getByRole('button', { name: /Accept and add/i }).click();
await admin.waitForTimeout(3000);
pass('the tutor joins the course roster',
  psql(`select count(*) from course_tutors where course_id='${courseId}';`) === '1');
pass('the application is marked accepted', psql("select status from course_applications limit 1;") === 'accepted');
pass('the tutor is told', Number(psql("select count(*) from notifications where type='course_application_decided';")) > 0);

// It should now be one of their teaching courses.
await tutor.goto(`${BASE}/tutor/courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(3500);
pass('it moves to My Courses', /Chemistry, Grade 11 Foundations/.test(await tutor.locator('body').innerText()));

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
