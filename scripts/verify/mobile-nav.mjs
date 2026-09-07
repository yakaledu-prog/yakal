// Navigation on a phone.
//
// The sidebar is a drawer on a phone, so reaching anything took two taps: open
// the drawer, then pick. Worse, the drawer defaulted to open, so every phone
// landed with the nav covering the page and the button that closes it
// underneath. A bottom bar is where a thumb already is.
//
// Only the handful each role opens constantly, marked per layout. Notifications
// is deliberately absent: it is a bell in the topbar with its own unread count.
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const b = await chromium.launch();

async function signIn(ctx, email) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.locator('input[type="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
  await p.waitForTimeout(3000);
  return p;
}

async function onPhone(email, expected) {
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await signIn(ctx, email);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  const bar = p.locator('nav[aria-label="Main"]');
  pass(`${email}: the bar is there`, await bar.isVisible().catch(() => false));

  const labels = (await bar.innerText()).split('\n').map((t) => t.trim()).filter(Boolean);
  pass(`${email}: it holds the right pages`, JSON.stringify(labels) === JSON.stringify(expected),
    JSON.stringify(labels));
  pass(`${email}: notifications stays in the topbar`, !labels.includes('Notifications'));
  // Five is what fits. Six starts truncating labels on a narrow phone.
  pass(`${email}: no more than five`, labels.length <= 5, String(labels.length));

  // The drawer defaulted to open, which covered the page and every tap on it.
  //
  // Measured, not read off the class list: shut on a phone still carries
  // md:translate-x-0 for the desktop case, so a substring test on the class
  // says "open" for a drawer that is entirely off screen.
  const drawerLeft = await p.locator('aside').first().evaluate((el) => el.getBoundingClientRect().left);
  pass(`${email}: the drawer starts shut`, drawerLeft < 0, `left=${Math.round(drawerLeft)}`);

  await bar.getByText(labels[1], { exact: true }).click();
  await p.waitForTimeout(1800);
  pass(`${email}: tapping one goes there`,
    (await p.evaluate(() => location.pathname)).length > `/${email.split('@')[0]}`.length,
    await p.evaluate(() => location.pathname));

  pass(`${email}: no page errors`, errs.length === 0, errs[0]?.slice(0, 120) ?? '');
  await ctx.close();
}

await onPhone('student@yakal.com', ['Home', 'Calendar', 'Tutoring', 'College', 'Messages']);
await onPhone('parent@yakal.com', ['Home', 'Courses', 'My Children', 'Messages']);
await onPhone('tutor@yakal.com', ['Teaching Hub', 'Students', 'Lessons', 'Calendar', 'Messages']);
await onPhone('counselor@yakal.com', ['Home', 'Students', 'Calendar', 'Messages']);

// A desktop has the sidebar and does not want a second navigation.
const desktop = await b.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await signIn(desktop, 'student@yakal.com');
pass('a desktop never sees it', !(await dp.locator('nav[aria-label="Main"]').isVisible().catch(() => false)));

// The home page it sits under carried two blocks of invented data: a "Notice"
// bar about a seminar, and an activity feed naming homework and a "Dr. Alex"
// who is not a person on this platform.
const home = await dp.locator('body').innerText();
pass('no invented notice on the student home', !/Upcoming SAT Prep Seminar/.test(home));
pass('no invented activity feed', !/Dr\. Alex graded/.test(home));

await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
