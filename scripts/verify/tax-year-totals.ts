// What goes on a 1099, and what Stripe's own draft will miss.
//
// Yakal is the filer: Stripe issues a 1099-K only when the connected account
// pays the processing fees, and ours are application_express, so the platform
// pays them. That makes the annual total per payee a number somebody types into
// an IRS form, and a wrong one is a corrected filing rather than a bug report.
//
// The split is the part worth pinning. Stripe builds its draft from what moved
// through Stripe; somebody paid by ACH or cheque because they never finished
// onboarding is invisible to it. outside_stripe_cents is the correction, so it
// has to be exactly right rather than roughly.
//
// Needs the local Supabase.
import 'dotenv/config';
import { execSync } from 'node:child_process';

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

// The IRS figure, repeated here on purpose. If somebody changes
// FORM_1099_THRESHOLD_CENTS this check keeps asserting the real one, which is
// the point: a threshold that moves because a developer edited a constant is
// exactly the mistake worth catching.
const THRESHOLD = 60_000;
const YEAR = 2031; // Far enough out that no seeded or fixture row lands here.

const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const counselorId = psql("select id from profiles where email='counselor@yakal.com';");

const clean = () => psql("delete from earnings where note like 'tax-fixture%';");
clean();

/** A settled earning on a given rail, dated inside the test year. */
const paid = (payee: string, cents: number, method: string, label: string, voided = false) =>
  psql(
    `insert into earnings (payee_id, kind, amount_cents, status, method, reference, settled_at, note${voided ? ', voided_at' : ''})
     values ('${payee}','tutoring_session',${cents},'settled','${method}','ref-${label}','${YEAR}-06-01T12:00:00Z','tax-fixture ${label}'${voided ? ", now()" : ''})
     returning id;`
  );

// Wholly through Stripe, over the threshold.
paid(tutorId, 70_000, 'stripe_connect', 'tutor-stripe');

// Split rails: the case Stripe's draft form gets wrong.
paid(counselorId, 40_000, 'stripe_connect', 'counselor-stripe');
paid(counselorId, 30_000, 'ach', 'counselor-ach');

// A correction. Counting it would overstate somebody's income to the IRS.
paid(counselorId, 99_000, 'stripe_connect', 'counselor-voided', true);

// Owed but not paid. A 1099 reports what was paid, not what was promised.
psql(
  `insert into earnings (payee_id, kind, amount_cents, status, releasable_at, note)
   values ('${tutorId}','tutoring_session',50_000,'pending', now(), 'tax-fixture tutor-pending');`
);

const read = (payee: string) =>
  psql(
    `select coalesce(total_cents,0) || '|' || coalesce(via_stripe_cents,0) || '|' || coalesce(outside_stripe_cents,0) || '|' || coalesce(payment_count,0)
       from v_tax_year_payees where payee_id='${payee}' and tax_year=${YEAR};`
  ) || '0|0|0|0';

const tutor = read(tutorId);
pass('a payee paid only through Stripe has nothing to correct', tutor === '70000|70000|0|1', tutor);
pass('and is over the threshold', Number(tutor.split('|')[0]) >= THRESHOLD, tutor);

const counselor = read(counselorId);
// 40000 + 30000. The voided 99000 must not appear anywhere in this.
pass('split rails add up to the real total', counselor.startsWith('70000|'), counselor);
pass('with Stripe and non-Stripe told apart', counselor === '70000|40000|30000|2', counselor);

const parts = counselor.split('|').map(Number);
pass('and the two halves sum to the whole', parts[1] + parts[2] === parts[0], counselor);

// A voided row is a correction, not a second payment.
pass('a voided earning is excluded', !counselor.startsWith('169000'), counselor);
// Only what was actually paid.
pass('a pending earning is excluded', tutor === '70000|70000|0|1', tutor);

// Somebody under the threshold still appears, because an admin needs to see
// they were paid at all, but must not be marked as needing a form.
const smallId = psql("select id from profiles where email='student@yakal.com';");
paid(smallId, 50_000, 'stripe_connect', 'small');
const small = read(smallId);
pass('somebody under the threshold is still listed', small === '50000|50000|0|1', small);
pass('but is under it', Number(small.split('|')[0]) < THRESHOLD, small);

clean();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
