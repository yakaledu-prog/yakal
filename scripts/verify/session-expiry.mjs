// An expired session sends you to sign in, and brings you back.
//
// It used to be a sentence. Changing a plan put "Your session has expired.
// Please sign in again." inside the modal, above a Confirm button that could
// never work again, and left somebody to work out that the cure was a reload.
// Nothing on the page offered to do it.
//
// Two ways a session dies, and they take different paths through authedFetch:
// a token we can see is past its expiry and cannot refresh, and a token that
// looks fine to us but the server rejects. Both have to end up in the same
// place.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const b = await chromium.launch();

async function signedInAt(path) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.locator('input[type="email"]').first().fill('parent@yakal.com');
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
  await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  return { ctx, p };
}

/**
 * Kill the session the way time does.
 *
 * sessionStorage, not localStorage: the client is configured that way so a
 * token cannot outlive the tab. `stale` puts the expiry in the past, which is
 * the case authedFetch can see for itself; otherwise the expiry is left alone
 * and only the token is corrupted, so the request goes out and comes back 401.
 */
const kill = (p, { stale }) =>
  p.evaluate(({ stale }) => {
    const key = Object.keys(sessionStorage).find((k) => k.includes('auth-token'));
    if (!key) return 'no session in storage';
    const v = JSON.parse(sessionStorage.getItem(key));
    if (stale) v.expires_at = Math.floor(Date.now() / 1000) - 3600;
    v.refresh_token = 'dead-refresh-token';
    v.access_token = v.access_token.slice(0, -6) + 'AAAAAA';
    sessionStorage.setItem(key, JSON.stringify(v));
    return key;
  }, { stale });

const callApi = (p) =>
  p.evaluate(async () => {
    const { authedPost } = await import('/src/lib/authedFetch.ts');
    return authedPost('/api/stripe?action=payment-methods', {});
  });

for (const stale of [true, false]) {
  const label = stale ? 'an expired token' : 'a token the server rejects';
  const { ctx, p } = await signedInAt('/parent/admissions');
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  pass(`${label}: the session is there to kill`, !(await kill(p, { stale })).startsWith('no session'));
  await callApi(p);
  await p.waitForTimeout(3500);

  const url = await p.evaluate(() => location.pathname + location.search);
  pass(`${label}: it goes to the login screen`, url.startsWith('/login'), url);
  pass(`${label}: it carries the page back`, url.includes('next=%2Fparent%2Fadmissions'), url);
  pass(`${label}: it says why`, /session expired/i.test(await p.locator('body').innerText()));
  // The dead end this replaced: the message rendered where you were standing.
  pass(`${label}: no dead end left behind`, !url.includes('/parent/admissions'));
  pass(`${label}: no page errors`, errs.length === 0, errs[0]?.slice(0, 120) ?? '');

  // And signing in puts you back rather than on the dashboard.
  await p.locator('input[type="email"]').first().fill('parent@yakal.com');
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForTimeout(4000);
  pass(`${label}: signing in returns you`,
    (await p.evaluate(() => location.pathname)) === '/parent/admissions',
    await p.evaluate(() => location.pathname));

  await ctx.close();
}

// A cold visit to a protected URL keeps it too, which is the same parameter
// doing the same job for somebody who was never signed in.
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/parent/billing`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
pass('a signed-out visit keeps the page too',
  (await p.evaluate(() => location.search)).includes('next=%2Fparent%2Fbilling'),
  await p.evaluate(() => location.pathname + location.search));

await b.close();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
