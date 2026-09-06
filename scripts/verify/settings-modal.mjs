// Settings opens, switches tabs, and shows real data.
//
// It was a page, on three of the five roles, linked from one button on the
// counsellor's home, and everything on it was invented: a "Demo User" with a
// demo@yakal.test address in inputs that saved nowhere, two notification
// checkboxes wired to nothing, and a dark mode toggle that reached past the
// theme system so the choice did not survive a reload.
//
// Headless, and deliberately. The push switch cannot be driven here, because
// Chrome disables the Push API in an incognito context and Playwright's
// contexts are all incognito. Driving it needs a persistent profile, and a
// headed persistent profile is where Playwright's synthesised clicks stop
// landing on the right element. So this covers the modal, and the push path
// is covered by push-delivery.ts against a real push service.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));

await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.locator('input[type="email"]').first().fill('parent@yakal.com');
await p.locator('input[type="password"]').first().fill('demo123');
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
await p.waitForTimeout(2500);

// page.url() is not updated by history.replaceState, which is what the modal
// uses, so the URL is read from the page itself.
const search = () => p.evaluate(() => location.search);
const panel = () => p.locator('[role="dialog"]').innerText();

// ---- it opens from the sidebar ----
await p.getByRole('button', { name: 'Settings' }).first().click();
await p.waitForTimeout(1200);
pass('the gear opens settings', (await p.getByRole('dialog').count()) === 1);
pass('the open tab is in the URL', (await search()) === '?settings=general', await search());

// ---- tabs ----
await p.getByRole('button', { name: 'Account', exact: true }).click();
await p.waitForTimeout(800);
const account = await panel();
pass('Account is selectable', (await search()) === '?settings=account', await search());
// The old page showed "Demo User" and demo@yakal.test to everybody.
pass('it shows the real account', /Tigist Worku/.test(account) && /parent@yakal\.com/.test(account));
pass('no invented account remains', !/Demo User|demo@yakal\.test/.test(account));

await p.getByRole('button', { name: 'Billing', exact: true }).click();
await p.waitForTimeout(800);
// A parent pays, so billing is theirs. A tutor sees earnings instead, and a
// student sees neither, which the tab says rather than showing an empty panel.
pass('Billing points a parent at their invoices', /Open billing/.test(await panel()));

await p.getByRole('button', { name: 'General', exact: true }).click();
await p.waitForTimeout(800);
pass('General carries appearance', /Appearance/.test(await panel()));

// ---- it closes ----
await p.keyboard.press('Escape');
await p.waitForTimeout(700);
pass('escape closes it', (await p.getByRole('dialog').count()) === 0);
pass('and takes the parameter with it', (await search()) === '', await search() || '(clean)');

await p.getByRole('button', { name: 'Settings' }).first().click();
await p.waitForTimeout(900);
await p.mouse.click(20, 20);
await p.waitForTimeout(700);
pass('a click outside closes it', (await p.getByRole('dialog').count()) === 0);

// ---- the route it replaced is gone ----
await p.goto(`${BASE}/parent/settings`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
pass('the old settings page is gone', !/Profile Information|SMS Alerts/.test(await p.locator('body').innerText()));

pass('no page errors', errs.length === 0, errs[0]?.slice(0, 140) ?? '');
await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
