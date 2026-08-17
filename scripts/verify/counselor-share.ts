import { shareForInstalment } from '../../api/_utils/counselor-pay.js';

// ============================================================
// A counsellor's share, split across instalments.
//
// This is somebody's pay, and every failure here is silent. A share that does
// not add back up to the whole is only ever found by the person who was short,
// months later, if they are counting. So the arithmetic is pinned rather than
// trusted: the parts must equal the total, exactly, at awkward percentages and
// awkward month counts.
// ============================================================

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) console.log(`ok    ${name}`);
  else {
    console.error(`FAIL  ${name}\n        expected ${b}\n        got      ${a}`);
    failures++;
  }
}

/** Every instalment of one plan, in order. */
const all = (price: number, pct: number | null, months: number) =>
  Array.from({ length: months }, (_, i) => shareForInstalment(price, pct, months, i + 1));

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

// --- nothing owed --------------------------------------------------------

check('no percentage set pays nothing', shareForInstalment(50000, null, 1, 1), 0);
check('zero percent pays nothing', shareForInstalment(50000, 0, 1, 1), 0);
check('a free tier pays nothing', shareForInstalment(0, 50, 1, 1), 0);

// --- the ordinary case ---------------------------------------------------

check('half of a one-off', shareForInstalment(50000, 50, 1, 1), 25000);
check('half of 100000 over 10 months', all(100000, 50, 10), Array(10).fill(5000));

// --- the parts must equal the whole --------------------------------------
//
// The remainder rides on the first instalment. Rounding each month separately
// would lose up to a cent a month, which is the bug this exists to prevent.

const awkward = all(99999, 33.33, 7);
check('an awkward split still sums to the total', sum(awkward), Math.round((99999 * 33.33) / 100));
check('the remainder rides on the first', awkward[0] >= awkward[1], true);
check('every later instalment is equal', new Set(awkward.slice(1)).size, 1);

for (const [price, pct, months] of [
  [12345, 17.5, 3],
  [70000, 60, 9],
  [999, 12.34, 5],
  [100001, 33.33, 12],
] as [number, number, number][]) {
  const parts = all(price, pct, months);
  check(
    `${pct}% of ${price} over ${months} sums exactly`,
    sum(parts),
    Math.round((price * pct) / 100)
  );
}

// --- edges ---------------------------------------------------------------

check('one hundred percent is the whole price', shareForInstalment(50000, 100, 1, 1), 50000);
check('a zero month count is treated as one', shareForInstalment(50000, 50, 0, 1), 25000);
check('a total smaller than the month count still sums', sum(all(10, 50, 10)), 5);

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
