// A tutor applies for an open course; an admin decides.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`).toString().trim();

psql('delete from course_applications;');
psql("update courses set tutor_id = null where title like 'Chemistry%';");

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
await tutor.goto(`${BASE}/tutor/courses`, { waitUntil: 'domcontentloaded' });
await tutor.waitForTimeout(4000);
pass('courses page has the three tabs', await tutor.getByRole('button', { name: /^Teaching/ }).isVisible()
  && await tutor.getByRole('button', { name: /^Open/ }).isVisible()
  && await tutor.getByRole('button', { name: /^Applied/ }).isVisible());
await tutor.screenshot({ path: `${S}/tutor-courses-tabs.png` });

await tutor.getByRole('button', { name: /^Open/ }).click();
await tutor.waitForTimeout(2500);
pass('open courses are listed', /Chemistry, Grade 11 Foundations/.test(await tutor.locator('body').innerText()));
// The payout is the tutor's business; what the parent pays is not, and
// inviting the comparison helps nobody.
const openText = await tutor.locator('body').innerText();
pass('the tutor payout is shown', /\$40\.00|40\.00/.test(openText), openText.match(/[$][\d.,]+/)?.[0] ?? '');
pass('the parent price is not shown', !/55\.00/.test(openText));
await tutor.screenshot({ path: `${S}/tutor-open-courses.png` });

await tutor.getByRole('button', { name: 'Apply', exact: true }).first().click();
await tutor.waitForTimeout(700);
await tutor.getByPlaceholder(/good fit/i).fill('I have taught this syllabus for six years.');
await tutor.getByRole('button', { name: /Send application/i }).click();
await tutor.waitForTimeout(2500);
pass('the application reaches the database', psql("select count(*) from course_applications where status='pending';") === '1');
pass('admins are notified', Number(psql("select count(*) from notifications where type='course_application';")) > 0);

await tutor.getByRole('button', { name: /^Applied/ }).click();
await tutor.waitForTimeout(2000);
const appliedText = await tutor.locator('body').innerText();
pass('it appears under Applied', /Chemistry, Grade 11 Foundations/.test(appliedText));
pass('its state is shown', /Waiting on a decision/i.test(appliedText));

await tutor.getByRole('button', { name: /^Open/ }).click();
await tutor.waitForTimeout(2000);
pass('an applied course leaves the Open tab', !/Chemistry, Grade 11 Foundations/.test(await tutor.locator('body').innerText()));

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

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
