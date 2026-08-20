// The published cancellation policy, applied.
//
// Every row here is a sentence from /cancellation-policy, which promised a 24
// hour notice window, a 50% fee inside it, and a full charge for a no-show
// while the code refunded nothing in any case.
//
// Pure: no database, no Stripe, no clock. The failure mode this guards is quiet
// rather than loud. An off-by-one in a notice window shows up in nobody's
// interface, only in a bank statement a week later, and by then the argument is
// about what the policy said rather than what the code did.
import {
  LATE_FEE_PERCENT,
  NOTICE_HOURS,
  decideCancellation,
  freeUntil,
  hoursOfNotice,
} from '../../api/_utils/cancellation.js';

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const NOW = new Date('2026-08-19T12:00:00Z');
/** A lesson `h` hours from now. */
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const PRICE = 10_000; // $100 for the lesson
const TUTOR = 7_000; //  $70 of it to the tutor

const decide = (h: number, by: 'family' | 'tutor' | 'admin') =>
  decideCancellation({
    slotPriceCents: PRICE,
    tutorEarningCents: TUTOR,
    startsAt: inHours(h),
    now: NOW,
    by,
  });

// ---- a family cancelling in time ----

const early = decide(48, 'family');
pass('two days out, the family is refunded in full', early.refundCents === PRICE, String(early.refundCents));
pass('and the tutor earns nothing', early.tutorEarningCents === 0, String(early.tutorEarningCents));
pass('recorded as in_notice', early.reason === 'in_notice', early.reason);

// The boundary itself, which is where a policy argument actually happens.
// "At least 24 hours' notice" includes exactly 24.
const exactly = decide(NOTICE_HOURS, 'family');
pass(
  `at exactly ${NOTICE_HOURS} hours it is still in time`,
  exactly.refundCents === PRICE && exactly.reason === 'in_notice',
  `${exactly.refundCents} / ${exactly.reason}`
);

const justInside = decide(NOTICE_HOURS - 0.01, 'family');
pass(
  'a minute later it is not',
  justInside.reason === 'late',
  justInside.reason
);

// ---- a family cancelling late ----

const late = decide(2, 'family');
pass(
  `two hours out, ${100 - LATE_FEE_PERCENT}% comes back`,
  late.refundCents === PRICE / 2,
  String(late.refundCents)
);
pass(
  'and the tutor keeps their share of the fee',
  late.tutorEarningCents === TUTOR / 2,
  String(late.tutorEarningCents)
);
pass('recorded as late', late.reason === 'late', late.reason);

// The platform keeps the difference between what the family forfeits and what
// the tutor is paid, which is the same split as a delivered lesson.
// Stated as a literal rather than recomputed from the same expressions the
// assertions above already pin, which would pass whatever the code did.
// $100 lesson, $50 back to the family, $35 to the tutor, $15 to the platform.
pass(
  'the platform keeps the rest, and only the rest',
  PRICE - late.refundCents - late.tutorEarningCents === 1_500,
  String(PRICE - late.refundCents - late.tutorEarningCents)
);

// ---- the tutor calling it off ----
//
// The 24 hours protects a tutor's blocked-out time from a last-minute change by
// the client, so applying it to the tutor would invert what it is for. A tutor
// cancelling ten minutes before pays the family back in full and earns nothing.

const tutorLate = decide(0.1, 'tutor');
pass('a tutor cancelling late still refunds the family in full', tutorLate.refundCents === PRICE);
pass('and earns nothing for it', tutorLate.tutorEarningCents === 0);
pass('recorded as tutor_cancelled', tutorLate.reason === 'tutor_cancelled', tutorLate.reason);

const adminLate = decide(0.1, 'admin');
pass('an admin cancelling refunds in full too', adminLate.refundCents === PRICE);
pass('and is recorded as such', adminLate.reason === 'admin', adminLate.reason);

// ---- money is never invented ----

for (const by of ['family', 'tutor', 'admin'] as const) {
  for (const h of [-5, 0, 1, 23, 24, 100]) {
    const o = decide(h, by);
    pass(
      `${by} at ${h}h gives back no more than was paid`,
      o.refundCents <= PRICE && o.refundCents >= 0,
      String(o.refundCents)
    );
    pass(
      `${by} at ${h}h never pays the tutor more than the lesson was worth`,
      o.tutorEarningCents <= TUTOR && o.tutorEarningCents >= 0,
      String(o.tutorEarningCents)
    );
    // The three shares are the whole, never more. Paying out more than came in
    // is the one arithmetic error here that costs real money.
    pass(
      `${by} at ${h}h does not pay out more than came in`,
      o.refundCents + o.tutorEarningCents <= PRICE,
      `${o.refundCents} + ${o.tutorEarningCents} vs ${PRICE}`
    );
  }
}

// ---- odd amounts ----
//
// Half of an odd number of cents has to fall somewhere. It falls to the family,
// because they have just lost a lesson.

const odd = decideCancellation({
  slotPriceCents: 999,
  tutorEarningCents: 701,
  startsAt: inHours(1),
  now: NOW,
  by: 'family',
});
pass('an odd price rounds the refund up, to the family', odd.refundCents === 500, String(odd.refundCents));
pass('and the tutor share down', odd.tutorEarningCents === 350, String(odd.tutorEarningCents));
pass(
  'and the two together still do not exceed the price',
  odd.refundCents + odd.tutorEarningCents <= 999,
  `${odd.refundCents} + ${odd.tutorEarningCents}`
);

// A free lesson refunds nothing rather than something negative.
const free = decideCancellation({
  slotPriceCents: 0,
  tutorEarningCents: 0,
  startsAt: inHours(1),
  now: NOW,
  by: 'family',
});
pass('a lesson nobody paid for refunds nothing', free.refundCents === 0 && free.tutorEarningCents === 0);

// ---- the deadline shown on screen ----

const starts = new Date('2026-09-01T14:00:00Z');
pass(
  'the free-cancellation deadline is a day before it starts',
  freeUntil(starts).toISOString() === '2026-08-31T14:00:00.000Z',
  freeUntil(starts).toISOString()
);
pass('notice is measured in hours, and is negative once it has begun', hoursOfNotice(inHours(-3), NOW) === -3);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
