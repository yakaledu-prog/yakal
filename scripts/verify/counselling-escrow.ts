// A counsellor is paid for a month at the end of it, and only if they worked.
//
// The bug this pins: the share used to be written when the subscription renewed
// and released 72 hours later, so a plan renewing on the 1st paid on the 4th for
// a month nobody had done yet. A counsellor who then stopped answering had
// already been paid, and the family's refund came out of Yakal.
//
// Four properties, all of them things that cost money to get wrong:
//
//   the hold runs to the end of the period, not to 72 hours after payment
//   a period still running does not pay, however long ago it was paid for
//   a finished period with nothing delivered does not pay, and says so once
//   a finished period with real work is payable
//
// The last one is asserted by its skip reason rather than by a transfer: no
// seeded counsellor has connected a bank, so the honest outcome is "no
// connected account". That it reaches that reason at all is the point, because
// the delivery gate sits in front of it.
//
// Needs the local Supabase and the seeded accounts.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import {
  cancelEarningsForCharge,
  HOLD_HOURS,
  NOTHING_DELIVERED,
  releaseDueEarnings,
} from '../../api/_utils/earnings.js';
import { getServiceClient } from '../../api/_utils/supabase.js';

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const counselorId = psql("select id from profiles where email='counselor@yakal.com';");
const parentId = psql("select id from profiles where email='parent@yakal.com';");
const tierId = psql("select id from admissions_tiers order by sort_order limit 1;");

// Three students, because admissions_plans_one_live allows a student only one
// live plan and this needs three side by side. Picked from whoever has none
// rather than named, so a change to the seed does not silently break this.
const students = psql(
  `select string_agg(id::text, ',') from (
     select p.id from profiles p
      where p.role = 'student'
        and not exists (
          select 1 from admissions_plans a
           where a.student_id = p.id and a.status in ('active','past_due')
        )
      limit 4
   ) s;`
).split(',');

if (students.length < 4) {
  console.error('needs four students with no live plan; run npm run db:reset');
  process.exit(1);
}
const [openStudent, idleStudent, workedStudent, refundedStudent] = students;

const clean = () => {
  psql("delete from earnings where source_charge_id = 'ch_escrow_fixture' or note like 'escrow-fixture%' or plan_id in (select id from admissions_plans where stripe_subscription_id like 'sub_escrow_fixture%');");
  psql("delete from sessions where subject like 'escrow-fixture%';");
  psql("delete from admissions_plans where stripe_subscription_id like 'sub_escrow_fixture%';");
};
clean();

/** A plan whose month ran from `from` to `to`, both relative to now. */
const makePlan = (label: string, student: string) =>
  psql(
    `insert into admissions_plans (student_id, purchased_by, tier_id, counselor_id, status, stripe_subscription_id)
     values ('${student}','${parentId}','${tierId}','${counselorId}','active','sub_escrow_fixture_${label}')
     returning id;`
  );

const makeEarning = (planId: string, startOffset: string, endOffset: string) =>
  psql(
    `insert into earnings (payee_id, kind, plan_id, period_start, period_end, amount_cents, status, releasable_at)
     select '${counselorId}','counselling_month','${planId}',
            (now() + interval '${startOffset}')::date,
            now() + interval '${endOffset}',
            18000,'pending',
            now() + interval '${endOffset}' + interval '${HOLD_HOURS} hours'
     returning id;`
  );

// ------------------------------------------------------------
// The hold runs to the end of the period
// ------------------------------------------------------------
const openPlan = makePlan('open', openStudent);
// Paid for a month ago, but the month is still running. Under the old rule this
// released three days after payment; it must not now.
const openEarning = makeEarning(openPlan, '-27 days', '3 days');

const heldUntil = psql(
  `select (releasable_at > now() + interval '3 days')::text from earnings where id='${openEarning}';`
);
pass('the hold runs past the end of the period, not 72 hours from payment', heldUntil === 'true', heldUntil);

// ------------------------------------------------------------
// A finished period with nothing delivered
// ------------------------------------------------------------
const idlePlan = makePlan('idle', idleStudent);
const idleEarning = makeEarning(idlePlan, '-40 days', '-10 days');

// ------------------------------------------------------------
// A finished period with real work in it
// ------------------------------------------------------------
const workedPlan = makePlan('worked', workedStudent);
const workedEarning = makeEarning(workedPlan, '-40 days', '-10 days');
psql(
  `insert into sessions (student_id, tutor_id, subject, date, start_time, duration_minutes, status, kind)
   select '${workedStudent}','${counselorId}','escrow-fixture advising',
          (now() - interval '20 days')::date, '10:00', 60, 'completed', 'advising';`
);

const db = getServiceClient();
const first = await releaseDueEarnings(db);
const reasonFor = (id: string) => first.skipped.find((s) => s.earningId === id)?.reason ?? 'not skipped';

pass('a period still running is not even considered', reasonFor(openEarning) === 'not skipped', reasonFor(openEarning));
pass(
  'a finished period with nothing delivered is refused',
  reasonFor(idleEarning) === NOTHING_DELIVERED,
  reasonFor(idleEarning)
);
// It got past the delivery gate and fell over on the bank instead, which is the
// correct answer for somebody who has not connected one.
pass(
  'a finished period with real work gets past the gate',
  reasonFor(workedEarning) === 'no connected account',
  reasonFor(workedEarning)
);
pass('neither was paid', first.transferred === 0, JSON.stringify(first.transferred));

// The news is worth telling once. A job running hourly must not say it hourly.
pass(
  'the held month is announced the first time',
  first.skipped.find((s) => s.earningId === idleEarning)?.firstTime === true
);
const note = psql(`select coalesce(note,'') from earnings where id='${idleEarning}';`);
pass('and the reason is written on the row', note.includes('no advising session'), note);

const second = await releaseDueEarnings(db);
pass(
  'but not announced again on the next run',
  second.skipped.find((s) => s.earningId === idleEarning)?.firstTime === false
);
pass('and it is still owed, not cancelled', psql(`select status from earnings where id='${idleEarning}';`) === 'pending');

// ------------------------------------------------------------
// A refunded month pays nobody
//
// The whole point of holding the money. Under the old rule the counsellor's
// share had already been transferred by day four, so refunding a family in week
// three cost Yakal the share on top of the refund: Stripe does not claw back a
// transfer when the charge behind it is refunded. Held, it is still ours to
// cancel.
// ------------------------------------------------------------
const refundedPlan = makePlan('refunded', refundedStudent);
const refundedEarning = makeEarning(refundedPlan, '-40 days', '-10 days');
psql(`update earnings set source_charge_id = 'ch_escrow_fixture' where id = '${refundedEarning}';`);
// Delivered, so nothing but the refund is stopping this from being paid.
psql(
  `insert into sessions (student_id, tutor_id, subject, date, start_time, duration_minutes, status, kind)
   select '${refundedStudent}','${counselorId}','escrow-fixture refunded advising',
          (now() - interval '20 days')::date, '10:00', 60, 'completed', 'advising';`
);

const { cancelled } = await cancelEarningsForCharge(db, 'ch_escrow_fixture', 'escrow-fixture refund');
pass('a refund cancels the month while it is still held', cancelled === 1, String(cancelled));
pass(
  'and it is cancelled, not merely skipped',
  psql(`select status from earnings where id='${refundedEarning}';`) === 'cancelled'
);

const third = await releaseDueEarnings(db);
pass(
  'so the release never sees it again',
  !third.skipped.some((s) => s.earningId === refundedEarning) &&
    !third.errors.some((e) => e.includes(refundedEarning))
);

clean();
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
