// ============================================================
// What leaves this server when something breaks.
//
// Error reports go to a third party. This process holds the Supabase
// service-role key, Stripe's secret and a Google refresh token, and every one of
// them has appeared in an error message at some point this month: Stripe echoes
// its key prefix, Google's client errors quote the token, and Supabase errors
// carry the JWT that was rejected.
//
// So the scrubbing is pinned rather than trusted. A leak here is silent, is
// somebody else's database, and cannot be taken back once sent.
// ============================================================

import { scrubForTest as scrub, redactForTest as redact } from '../../api/_utils/report.js';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

// --- credentials inside a message ---------------------------------------

const secrets: [string, string][] = [
  ['a Stripe secret key', 'No such customer: sk_test_51QabcDEFghij0123456789'],
  ['a Stripe live key', 'auth failed for sk_live_51QabcDEFghij0123456789'],
  ['a Google refresh token', 'invalid_grant for 1//03VSw-gr9AbCdEfGhIjKlMnOpQrStUvWx'],
  ['a JWT', 'rejected eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc-DEF_123'],
  ['a bearer header', 'sent Bearer sk_test_abcdefghijklmnop'],
];

for (const [label, message] of secrets) {
  const out = redact(message);
  const leaked =
    out.includes('sk_test_51Q') ||
    out.includes('sk_live_51Q') ||
    out.includes('1//03VSw') ||
    out.includes('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ') ||
    /Bearer\s+sk_test_abcdef/i.test(out);
  check(`${label} is removed from a message`, !leaked, out.slice(0, 60));
}

check('ordinary text survives', redact('That class was not found') === 'That class was not found');

// --- the event shape ------------------------------------------------------

const event = scrub({
  request: {
    cookies: { session: 'abc' },
    data: { password: 'hunter2' },
    headers: { authorization: 'Bearer secret' },
    query_string: 'token=abc123',
  },
  user: { id: 'user-1', email: 'child@example.com', ip_address: '1.2.3.4' },
  extra: { access_token: 'abc', courseId: 'course-1' },
  tags: { user_email: 'a@b.c', handler: 'classroom' },
  exception: { values: [{ value: 'failed with sk_test_51QabcDEFghij0123456789' }] },
});

check('cookies are dropped', event.request.cookies === undefined);
check('the request body is dropped', event.request.data === undefined);
check('headers are dropped', event.request.headers === undefined);
check('the query string is dropped', event.request.query_string === undefined);
check('the user keeps only an id', JSON.stringify(event.user) === '{"id":"user-1"}', JSON.stringify(event.user));
check('a token in extra is dropped', event.extra.access_token === undefined);
check('a harmless extra survives', event.extra.courseId === 'course-1');
check('an email tag is dropped', event.tags.user_email === undefined);
check('a harmless tag survives', event.tags.handler === 'classroom');
check(
  'a key inside the exception is redacted',
  !event.exception.values[0].value.includes('sk_test_51Q'),
  event.exception.values[0].value
);

// A user object with no id is removed rather than sent empty.
const anon = scrub({ user: { email: 'a@b.c' } });
check('a user with no id is dropped entirely', anon.user === undefined);

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
