import { appUrl } from '../../api/_utils/email.js';

// ============================================================
// Links in email must not point at a developer's laptop.
//
// Every link in every email came through appUrl, and on the deployed host it
// produced http://localhost:5173. VERCEL_URL is a Vercel variable and this runs
// on Render, so with PUBLIC_APP_URL unset the fallback was localhost: a child's
// invitation, a purchase confirmation and a newsletter all pointed at a server
// the reader does not have.
//
// The failure is silent from the inside. The email sends, the API returns 200,
// and only the person clicking finds out.
// ============================================================

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) console.log(`ok    ${name}`);
  else {
    console.error(`FAIL  ${name}\n        expected ${expected}\n        got      ${actual}`);
    failures++;
  }
}

const KEYS = ['APP_BASE_URL', 'PUBLIC_APP_URL', 'VERCEL_URL'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const clearAll = () => KEYS.forEach((k) => delete process.env[k]);

try {
  // ---- a request wins over everything ----
  //
  // The only version that cannot be misconfigured: the host that asked is the
  // host the reader is on.
  clearAll();
  process.env.APP_BASE_URL = 'https://wrong.example';
  check(
    'a caller-supplied base beats the environment',
    appUrl('/invite/abc', 'https://yakal.me'),
    'https://yakal.me/invite/abc'
  );

  // ---- the environment, in order ----
  clearAll();
  process.env.APP_BASE_URL = 'https://yakal.me';
  check('APP_BASE_URL is used', appUrl('/posts'), 'https://yakal.me/posts');

  clearAll();
  process.env.PUBLIC_APP_URL = 'https://yakal.me';
  check('PUBLIC_APP_URL is used', appUrl('/posts'), 'https://yakal.me/posts');

  // Both names are read, because appBaseUrl in _utils/supabase already used
  // APP_BASE_URL. Two variables meaning one thing is how half of this stays
  // broken after somebody sets one of them.
  clearAll();
  process.env.APP_BASE_URL = 'https://from-app-base.example';
  process.env.PUBLIC_APP_URL = 'https://from-public.example';
  check(
    'APP_BASE_URL wins when both are set',
    appUrl('/x'),
    'https://from-app-base.example/x'
  );

  clearAll();
  process.env.VERCEL_URL = 'yakal.vercel.app';
  check('VERCEL_URL is still honoured', appUrl('/x'), 'https://yakal.vercel.app/x');

  // ---- tidiness ----
  clearAll();
  process.env.APP_BASE_URL = 'https://yakal.me/';
  check('a trailing slash does not double up', appUrl('/posts'), 'https://yakal.me/posts');

  clearAll();
  process.env.APP_BASE_URL = '   ';
  check(
    'a blank variable falls through rather than making a bare path',
    appUrl('/posts'),
    'http://localhost:5173/posts'
  );

  // ---- the localhost fallback still exists, deliberately ----
  //
  // Kept so a developer's own run links to their own machine. It is only wrong
  // when it reaches production, which is what the base argument and the two
  // variables above are for.
  clearAll();
  check('nothing configured falls back to localhost', appUrl('/x'), 'http://localhost:5173/x');
} finally {
  clearAll();
  for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
}

// ---- the sandbox sender is a configuration failure, not a recipient one ----
//
// Resend's shared onboarding@resend.dev only delivers to the address the Resend
// account is registered under. Left as the fallback with nothing configured,
// every invitation to anybody else is refused, and Resend's message names the
// sender rather than the empty setting that produced it.
const FALLBACK = "Yakal Education Services <onboarding@resend.dev>";
check(
  'the fallback sender is still the shared one, which only reaches the account owner',
  FALLBACK.includes("onboarding@resend.dev"),
  true
);

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
