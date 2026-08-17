import { clientIp } from '../../api/_handlers/ai-chat.js';

// ============================================================
// The landing assistant's rate limit is keyed on the caller's address, and
// that address used to be forgeable.
//
// clientIp took the leftmost value of X-Forwarded-For. Proxies append rather
// than replace, so a caller sending "X-Forwarded-For: 9.9.9.9" arrives as
// "9.9.9.9, <real ip>" and the leftmost entry is whatever they typed. Sending
// a different one per request bypassed the limiter entirely, on the one
// endpoint that is public, unauthenticated, and spends an API key.
//
// These cases pin the reading: count from the right, because each hop appends
// the peer it actually saw.
// ============================================================

let failures = 0;

function check(name: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`ok    ${name}`);
  } else {
    console.error(`FAIL  ${name}\n        expected ${expected}, got ${actual}`);
    failures++;
  }
}

const req = (forwarded?: string | string[], remote = '10.0.0.1') =>
  ({
    headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded },
    socket: { remoteAddress: remote },
  }) as never;

// The ordinary case: one proxy, which sets the header to the real caller.
check('a single hop is the caller', clientIp(req('203.0.113.7')), '203.0.113.7');

// The attack. Anything the caller writes ends up left of what the proxy saw.
check(
  'a forged leading entry is ignored',
  clientIp(req('9.9.9.9, 203.0.113.7')),
  '203.0.113.7'
);
check(
  'a whole forged chain is ignored',
  clientIp(req('1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7')),
  '203.0.113.7'
);

// Node gives a repeated header as an array; joining keeps the order.
check(
  'a repeated header still reads from the right',
  clientIp(req(['9.9.9.9', '203.0.113.7'])),
  '203.0.113.7'
);

// No header at all, e.g. a direct connection in development.
check('no header falls back to the socket', clientIp(req(undefined)), '10.0.0.1');

// A header of only whitespace must not produce an empty key, or every such
// caller shares one bucket with everyone else who sent nothing.
check('an empty header falls back to the socket', clientIp(req('  ,  ')), '10.0.0.1');

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
