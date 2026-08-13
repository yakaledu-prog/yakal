// Quota checks are deterministic and need no server, database, or Groq call.
import assert from 'node:assert/strict';
import { createSupportRateLimiter } from '../../api/_utils/support-rate-limit.js';

let now = 1_000;
const limiter = createSupportRateLimiter({
  windowMs: 10_000,
  maxRequests: 2,
  maxConcurrent: 1,
  now: () => now,
});

const first = limiter.acquire('user-a');
assert.equal(first.allowed, true);

const concurrent = limiter.acquire('user-a');
assert.deepEqual(concurrent, { allowed: false, retryAfterSeconds: 1 });

if (first.allowed) {
  first.release();
  first.release(); // Release is intentionally idempotent.
}

const second = limiter.acquire('user-a');
assert.equal(second.allowed, true);
if (second.allowed) second.release();

const exhausted = limiter.acquire('user-a');
assert.equal(exhausted.allowed, false);
if (!exhausted.allowed) assert.equal(exhausted.retryAfterSeconds, 10);

const otherUser = limiter.acquire('user-b');
assert.equal(otherUser.allowed, true);
if (otherUser.allowed) otherUser.release();

now += 10_000;
const reset = limiter.acquire('user-a');
assert.equal(reset.allowed, true);
if (reset.allowed) reset.release();

console.log('support rate limiting passed');
