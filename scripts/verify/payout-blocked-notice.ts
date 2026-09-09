// Somebody owed money who cannot be paid gets told, once.
//
// releaseDueEarnings leaves an earning pending when the payee has no connected
// Stripe account. That is the right thing to do with the money: it is still
// theirs and it moves on its own once they onboard. What was wrong is that the
// only evidence was a count in the JSON the cron job returns, which nobody
// reads, so an earning could sit for weeks and the first sign was a tutor
// asking why they had not been paid.
//
// Two properties, and the second is the one that makes the first usable:
//
//   the payee is told their money is waiting, and admins are told somebody
//   cannot be paid
//   running the job again says nothing further, because Supabase Cron calls it
//   hourly and this would otherwise be two dozen messages a day
//
// The latch is earnings.payout_blocked_notified_at, the same shape
// delivery_flagged_at uses for a held counselling month. It is cleared when the
// earning settles, so a payee blocked again later hears about it again.
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
import 'dotenv/config';
import { execSync } from 'node:child_process';

process.env.JOBS_TOKEN = process.env.JOBS_TOKEN || 'verify-jobs-token';

const handler = (await import('../../api/_handlers/run-jobs.js')).default;

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const studentId = psql("select id from profiles where role='student' limit 1;");
const parentId = psql("select id from profiles where email='parent@yakal.com';");

const clean = () => {
  psql("delete from notifications where title in ('Your money is waiting','Somebody cannot be paid');");
  psql("delete from earnings where source_charge_id = 'ch_blocked_fixture';");
  psql("delete from invoices where description like 'blocked-fixture%';");
};
clean();

const invoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status, stripe_charge_id)
   values ('${parentId}','${studentId}','${tutorId}','blocked-fixture purchase',8400,5600,'tutoring','paid','ch_blocked_fixture')
   returning id;`
);

// Due now, so the release step reaches it on the first run. The seeded tutor
// has no stripe_account_id, which is the case under test.
psql(
  `insert into earnings (payee_id, kind, invoice_id, amount_cents, currency, source_charge_id, status, releasable_at)
   values ('${tutorId}','tutoring_session','${invoiceId}',7000,'usd','ch_blocked_fixture','pending', now() - interval '1 hour');`
);

const res = () => {
  const out: any = { status: 0, body: null };
  return {
    out,
    res: {
      status(c: number) { out.status = c; return this; },
      json(b: any) { out.body = b; return this; },
      end() { return this; },
    } as any,
  };
};

const run = async () => {
  const { out, res: r } = res();
  await handler(
    { method: 'POST', headers: { 'x-jobs-token': process.env.JOBS_TOKEN }, body: {} } as any,
    r
  );
  return out.body;
};

await run();

const payeeNotices = () =>
  Number(psql(`select count(*) from notifications where title='Your money is waiting' and user_id='${tutorId}';`));
const adminNotices = () =>
  Number(psql("select count(*) from notifications where title='Somebody cannot be paid';"));
const admins = Number(psql("select count(*) from profiles where role='admin';"));

pass('the payee is told their money is waiting', payeeNotices() === 1, `${payeeNotices()} notice(s)`);
pass('every admin is told somebody cannot be paid', adminNotices() === admins, `${adminNotices()} of ${admins}`);
pass(
  'the amount is named, not just the fact',
  psql(`select message from notifications where title='Your money is waiting' and user_id='${tutorId}' limit 1;`).includes('$70.00')
);
pass(
  'the earning is latched',
  psql("select payout_blocked_notified_at is not null from earnings where source_charge_id='ch_blocked_fixture';") === 't'
);

await run();
await run();

pass('a second and third run tell the payee nothing further', payeeNotices() === 1, `${payeeNotices()} notice(s)`);
pass('and tell the admins nothing further', adminNotices() === admins, `${adminNotices()} of ${admins}`);

pass(
  'the money is still owed, not failed',
  psql("select status from earnings where source_charge_id='ch_blocked_fixture';") === 'pending'
);

clean();

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
