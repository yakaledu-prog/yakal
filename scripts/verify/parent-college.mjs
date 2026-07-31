// The parent's read-only view of a child's college work.
//
// Checks three things the UI cannot be trusted to report about itself: that
// the parent sees the child's real seeded colleges rather than the invented
// MIT/Harvard list, that no control which would write to the child's rows is
// rendered, and that the student's own page still edits normally.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

// The parent's college views are gated on the admissions service, which is a
// real toggle anyone can flip while testing. Set the precondition rather than
// inheriting whatever the last session left behind.
execSync(
  `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -q -c "update child_services set is_active = true where service = 'admissions';"`,
  { stdio: 'ignore' }
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

await parent.goto(`${BASE}/parent/college-list`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
const listText = await parent.locator('body').innerText();
pass('college list shows the seeded colleges', /Massachusetts Institute of Technology/.test(listText) && /Addis Ababa University/.test(listText));
pass('no invented Harvard row', !/Harvard University/.test(listText));
pass('no Add School button for a parent', !(await parent.getByRole('button', { name: /Add School/i }).isVisible().catch(() => false)));
pass('no per-row status dropdown', (await parent.getByRole('button', { name: /^Status for /i }).count()) === 0);
pass('no per-row options menu', (await parent.getByRole('button', { name: /More options for /i }).count()) === 0);
pass('reader still gets Export CSV', await parent.getByRole('button', { name: /Export CSV/i }).isVisible().catch(() => false));
await parent.screenshot({ path: `${S}/parent-college-list.png`, fullPage: true });

await parent.goto(`${BASE}/parent/roadmap`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
const roadText = await parent.locator('body').innerText();
pass('roadmap shows the seeded major', /Computer Science/.test(roadText));
pass('roadmap shows the grad year', /2026/.test(roadText));
pass('roadmap has no editable major field', (await parent.locator('input[placeholder="e.g. Computer Science"]').count()) === 0);
await parent.screenshot({ path: `${S}/parent-roadmap.png`, fullPage: true });

await parent.goto(`${BASE}/parent/children`, { waitUntil: 'domcontentloaded' });
await parent.waitForTimeout(3500);
await parent.getByRole('button', { name: 'Application Tracking', exact: true }).click();
await parent.waitForTimeout(3500);
const trackText = await parent.locator('body').innerText();
pass('tracker shows the child real colleges', /University of Toronto/.test(trackText));
pass('tracker has no decision dropdown', (await parent.getByRole('button', { name: /^Decision for /i }).count()) === 0);
// Requirement chips render as buttons; for a parent every one must be inert.
// The card/table view toggle also carries aria-pressed and is legitimately
// clickable, so it is excluded: switching view writes nothing.
const chips = parent.locator('button[aria-pressed]:not([aria-label="Card view"]):not([aria-label="Table view"])');
const chipCount = await chips.count();
let enabled = 0;
for (let i = 0; i < chipCount; i++) if (await chips.nth(i).isEnabled()) enabled++;
pass('requirement chips are present', chipCount > 0, `${chipCount} chips`);
pass('no requirement chip is clickable', enabled === 0, `${enabled} enabled`);
await parent.screenshot({ path: `${S}/parent-application-tracking.png`, fullPage: true });

// ---------- student, unchanged ----------
const student = await signIn('student@yakal.com');
await student.goto(`${BASE}/student/college-list`, { waitUntil: 'domcontentloaded' });
await student.waitForTimeout(3500);
pass('student still has Add School', await student.getByRole('button', { name: /Add School/i }).isVisible().catch(() => false));
pass('student still has status dropdowns', (await student.getByRole('button', { name: /^Status for /i }).count()) > 0);

await student.goto(`${BASE}/student/my-app`, { waitUntil: 'domcontentloaded' });
await student.waitForTimeout(3500);
const sChips = student.locator('button[aria-pressed]');
pass('student requirement chips are clickable', (await sChips.count()) > 0 && (await sChips.first().isEnabled()));
await student.screenshot({ path: `${S}/student-my-app.png`, fullPage: true });

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
