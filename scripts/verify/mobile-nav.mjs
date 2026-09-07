// Navigation on a phone.
//
// There was briefly a bottom bar here. It was removed: five tabs could not
// carry a nav of thirteen items without deciding for somebody which pages
// mattered, and a bar that answers half the question is worse than a drawer
// that answers all of it. What the attempt did turn up is worth keeping, and
// this is what pins it.
//
// The drawer defaulted to open, so every phone landed with the navigation
// covering the page and the button that dismisses it underneath. And it stayed
// open after you picked something, so the first tap on the page you asked for
// was spent getting rid of it.
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

/**
 * Off screen, or over the page. Measured, because the class list says both:
 * shut on a phone still carries md:translate-x-0 for the desktop case.
 *
 * Named rather than "the first aside": the settings modal has one of its own,
 * and it comes first in the DOM, so an unscoped locator measures its tab rail
 * and reports the drawer as open.
 */
const drawerLeft = (p) =>
  p.locator('aside[aria-label="Sidebar"]').evaluate((el) => el.getBoundingClientRect().left);

const ctx = await b.newContext({ ...devices['Pixel 7'] });
const p = await signIn(ctx, 'student@yakal.com');
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));

pass('the drawer starts shut on a phone', (await drawerLeft(p)) < 0, `left=${Math.round(await drawerLeft(p))}`);

// The menu button is the only way in, so it has to be reachable, which it was
// not while the drawer it opens was sitting on top of it.
await p.locator('header button').first().click();
await p.waitForTimeout(700);
pass('the menu button opens it', (await drawerLeft(p)) === 0, `left=${Math.round(await drawerLeft(p))}`);

await p.getByRole('link', { name: 'Calendar' }).first().click();
await p.waitForTimeout(1800);
pass('following a link goes there', (await p.evaluate(() => location.pathname)) === '/student/calendar',
  await p.evaluate(() => location.pathname));
pass('and puts the drawer away', (await drawerLeft(p)) < 0, `left=${Math.round(await drawerLeft(p))}`);

// Everything that leaves the drawer has to close it, not only the nav links.
// The profile card at the bottom is a link too, and it left the drawer sitting
// over the page it had just opened.
for (const [what, open] of [
  ['the profile card', async () => {
    await p.locator('aside[aria-label="Sidebar"] a[href$="/profile"]').first().click();
  }],
  ['the settings button', async () => {
    await p.locator('aside[aria-label="Sidebar"] button[aria-label="Settings"]').first().click();
  }],
]) {
  await p.locator('header button').first().click();
  await p.waitForTimeout(600);
  await open();
  await p.waitForTimeout(1400);
  pass(`${what} closes the drawer`, (await drawerLeft(p)) < 0,
    `left=${Math.round(await drawerLeft(p))} url=${await p.evaluate(() => location.pathname + location.search)}`);
  // Settings opens a modal over the page; put it away before the next round.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
}

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 120) ?? '');
await ctx.close();

// A desktop is not a phone: the sidebar is a rail, not a drawer, and it starts
// open. Closing it on every link would collapse it as soon as anybody used it.
const desktop = await b.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await signIn(desktop, 'student@yakal.com');
pass('a desktop sidebar starts open', (await drawerLeft(dp)) === 0);
await dp.getByRole('link', { name: 'Calendar' }).first().click();
await dp.waitForTimeout(1500);
pass('and stays open when you use it', (await drawerLeft(dp)) === 0);

// The home page carried two blocks of invented data: a fixed "Notice" bar
// about a seminar that does not exist, and an activity feed naming homework
// from the same mock and a "Dr. Alex" who is not a person on this platform.
const home = await (await signIn(desktop, 'student@yakal.com')).locator('body').innerText();
pass('no invented notice on the student home', !/Upcoming SAT Prep Seminar/.test(home));
pass('no invented activity feed', !/Dr\. Alex graded/.test(home));

await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
