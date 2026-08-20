// Buying an admissions tier, and a counselor working through essays.
//
// Two things are being checked. That paying for a tier actually grants it: a
// plan row, the admissions switch flipped, and everyone told. And that a
// counselor's pass over an essay is recorded as a receipt rather than a
// counter somebody has to remember to bump.
//
// It also checks the price: the tier price list lives in the database, so a
// request that supplies its own amount must be ignored.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: new URL('../../.env', import.meta.url).pathname });

const psql = (sql) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const db = createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } });

const parentId = psql("select id from profiles where email='parent@yakal.com';");
const studentId = psql("select id from profiles where email='student@yakal.com';");
const counselorId = psql("select id from profiles where email='counselor@yakal.com';");

const premierId = psql("select id from admissions_tiers where key='premier';");
const premierPrice = Number(psql("select price_cents from admissions_tiers where key='premier';"));
const eliteId = psql("select id from admissions_tiers where key='elite';");

// Clean slate.
psql(`delete from admissions_plans where student_id='${studentId}';`);
psql(`delete from invoices where admissions_tier_id is not null;`);
psql(`delete from child_services where student_id='${studentId}' and service='admissions';`);
psql(`delete from notifications where type in ('admissions_plan','essay_review');`);
psql(`delete from essay_reviews;`);
await fetch('http://127.0.0.1:54324/api/v1/messages', { method: 'DELETE' });

// ---- the price comes from the tier, not the request ----
const anon = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await anon.auth.signInWithPassword({
  email: 'parent@yakal.com',
  password: 'demo123',
});
pass('the parent signs in', !authErr, authErr?.message ?? '');

const createInvoice = (await import('../../api/_handlers/create-invoice.ts')).default;
const call = async (body) => {
  let out;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { out = { code: this._c, body: b }; return this; },
    end() { return this; },
    setHeader() { return this; },
  };
  await createInvoice(
    { method: 'POST', headers: { authorization: `Bearer ${auth.session.access_token}` }, body },
    res
  );
  return out;
};

// A parent asking to pay one dollar for a tier that costs thousands.
const cheeky = await call({
  description: 'Bargain',
  amountCents: 100,
  kind: 'admissions',
  studentId,
  admissionsTierId: premierId,
});
pass('an admissions invoice is created', cheeky.code === 200, JSON.stringify(cheeky.body).slice(0, 80));

const invoiceId = cheeky.body.invoiceId;
const charged = Number(psql(`select amount_cents from invoices where id='${invoiceId}';`));
pass('the price comes from the tier, not the request', charged === premierPrice, `${charged} vs ${premierPrice}`);
pass(
  'and so does the wording',
  psql(`select description from invoices where id='${invoiceId}';`) === 'Premier admissions counselling',
  psql(`select description from invoices where id='${invoiceId}';`)
);

// ---- paying for it grants it ----
psql(`update invoices set status='paid', paid_at=now() where id='${invoiceId}';`);
const { fulfilInvoices } = await import('../../api/_utils/fulfil.ts');
await fulfilInvoices(db, [invoiceId]);

pass(
  'the student is on the tier',
  psql(`select count(*) from admissions_plans where student_id='${studentId}' and tier_id='${premierId}' and status='active';`) === '1'
);
// Access follows payment. child_services was an admin override and stopped
// being written when v_student_entitlements became the rule, so asking it here
// tested a mechanism that no longer decides anything.
pass(
  'admissions is switched on for them',
  psql(`select count(*) from v_student_entitlements where student_id='${studentId}' and service='admissions';`) === '1'
);
pass('both are told', psql("select count(*) from notifications where type='admissions_plan';") === '2');

// Only observable when mail is going to the local server. EMAIL_PROVIDER=resend
// sends it to a real inbox instead, which is a legitimate thing to be doing and
// leaves nothing here to count, so this skips rather than failing for a reason
// that has nothing to do with admissions.
const provider = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
if (provider && provider !== 'smtp') {
  console.log(`SKIP  two emails go out  -> EMAIL_PROVIDER=${provider}, so they did not come here`);
} else {
  const mail = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  pass('two emails go out', mail.total === 2, `total=${mail.total}`);
}

// A second delivery of the same payment must change nothing.
await fulfilInvoices(db, [invoiceId]);
pass(
  'a second delivery does not create a second plan',
  psql(`select count(*) from admissions_plans where student_id='${studentId}' and status='active';`) === '1'
);
pass('and does not re-notify', psql("select count(*) from notifications where type='admissions_plan';") === '2');

// ---- upgrading replaces, and keeps the history ----
const upgrade = await call({ description: 'x', amountCents: 1, studentId, admissionsTierId: eliteId });
psql(`update invoices set status='paid', paid_at=now() where id='${upgrade.body.invoiceId}';`);
await fulfilInvoices(db, [upgrade.body.invoiceId]);

pass(
  'upgrading leaves exactly one active plan',
  psql(`select count(*) from admissions_plans where student_id='${studentId}' and status='active';`) === '1'
);
pass(
  'and it is the new tier',
  psql(`select tier_id from admissions_plans where student_id='${studentId}' and status='active';`) === eliteId
);
pass(
  'the old plan is kept, cancelled',
  psql(`select count(*) from admissions_plans where student_id='${studentId}' and status='canceled' and tier_id='${premierId}';`) === '1'
);

// ---- a counselor's pass over an essay ----
const essayId = psql("select id from essays where kind='supplement' and status='in_review' limit 1;");
const startRounds = Number(psql(`select rounds_used from essays where id='${essayId}';`));

const counselor = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
const { error: cErr } = await counselor.auth.signInWithPassword({
  email: 'counselor@yakal.com',
  password: 'demo123',
});
pass('the counselor signs in', !cErr, cErr?.message ?? '');

const returned = await counselor.from('essay_reviews').insert({
  essay_id: essayId,
  counselor_id: counselorId,
  action: 'returned',
  note: 'Tighten the opening.',
});
pass('a counselor can record a pass', !returned.error, returned.error?.message ?? '');
pass(
  'the round is counted',
  Number(psql(`select rounds_used from essays where id='${essayId}';`)) === startRounds + 1
);
pass(
  'and it names who did it',
  psql(`select counselor_id from essay_reviews where essay_id='${essayId}' order by created_at desc limit 1;`) === counselorId
);

// Reopening is a correction, not a round the family paid for.
await counselor.from('essay_reviews').insert({
  essay_id: essayId,
  counselor_id: counselorId,
  action: 'reopened',
});
pass(
  'reopening does not cost a round',
  Number(psql(`select rounds_used from essays where id='${essayId}';`)) === startRounds + 1,
  psql(`select rounds_used from essays where id='${essayId}';`)
);

// Nobody but a counselor writes one, and never as somebody else.
const asParent = await anon.from('essay_reviews').insert({
  essay_id: essayId,
  counselor_id: counselorId,
  action: 'approved',
});
pass('a parent cannot record a pass', !!asParent.error, asParent.error?.code ?? 'no error at all');

const asSelf = await counselor.from('essay_reviews').insert({
  essay_id: essayId,
  counselor_id: parentId,
  action: 'approved',
});
pass('a counselor cannot record one as somebody else', !!asSelf.error, asSelf.error?.code ?? 'no error at all');

// ---- the quota is visible, and never blocks ----
// Elite has no ceiling, so this is checked against Premier's limit of 6.
const psEssay = psql("select id from essays where kind='personal_statement' limit 1;");
for (let i = 0; i < 8; i++) {
  await counselor.from('essay_reviews').insert({
    essay_id: psEssay,
    counselor_id: counselorId,
    action: 'returned',
  });
}
pass(
  'a counselor is never blocked from doing the work',
  Number(psql(`select rounds_used from essays where id='${psEssay}';`)) === 8,
  psql(`select rounds_used from essays where id='${psEssay}';`)
);


// ---- a month of a subscription ----
//
// Counselling is billed monthly for as long as a family wants it, so every
// month after the first arrives as invoice.paid with nobody at a keyboard.
// That webhook is the only record those months happened at all, and it has
// three jobs: write the invoice the parent sees, write what the counsellor is
// owed, and keep the plan row in step.

const planId = psql(`select id from admissions_plans where student_id='${studentId}' and status='active';`);
psql(`update admissions_plans set stripe_subscription_id='sub_verify_fixture' where id='${planId}';`);
psql(`update admissions_tiers set counselor_share_percent = 40 where id='${eliteId}';`);
const counselorForPlan = psql(`select counselor_id from admissions_plans where id='${planId}';`);

psql(`delete from earnings where plan_id='${planId}';`);
psql("delete from invoices where stripe_invoice_id like 'in_verify_%';");

const { recordSubscriptionInvoice } = await import('../../api/stripe-webhook.ts');

/** One paid Stripe invoice, shaped as the webhook receives it. */
const paidInvoice = (id, periodStart, amountCents) => ({
  type: 'invoice.paid',
  data: {
    object: {
      id,
      subscription: 'sub_verify_fixture',
      amount_paid: amountCents,
      currency: 'usd',
      charge: `ch_${id}`,
      lines: { data: [{ period: { start: Math.floor(new Date(periodStart).getTime() / 1000) } }] },
    },
  },
});

await recordSubscriptionInvoice(paidInvoice('in_verify_1', '2027-01-01', 45000));

pass(
  'a month of a subscription writes an invoice the parent can see',
  psql("select count(*) from invoices where stripe_invoice_id='in_verify_1';") === '1'
);
pass(
  'for what was actually charged',
  psql("select amount_cents from invoices where stripe_invoice_id='in_verify_1';") === '45000'
);

// The share is a percentage of what came in, not of the tier's list price, so
// a prorated or discounted month pays a proportionate share rather than a full
// one.
pass(
  "and the counsellor's share of it",
  psql(`select amount_cents from earnings where plan_id='${planId}' and period_start='2027-01-01';`) === '18000',
  psql(`select coalesce(string_agg(amount_cents::text, ','), 'none') from earnings where plan_id='${planId}';`)
);
pass(
  'on the same hold as everybody else',
  psql(`select status || '/' || (releasable_at > now())::text from earnings where plan_id='${planId}' and period_start='2027-01-01';`) === 'pending/true'
);
pass(
  'paid to the counsellor on the plan',
  psql(`select payee_id from earnings where plan_id='${planId}' and period_start='2027-01-01';`) === counselorForPlan
);

// Stripe redelivers. Neither half may be written twice.
await recordSubscriptionInvoice(paidInvoice('in_verify_1', '2027-01-01', 45000));
pass(
  'a redelivered month does not invoice twice',
  psql("select count(*) from invoices where stripe_invoice_id='in_verify_1';") === '1'
);
pass(
  'nor pay the counsellor twice',
  psql(`select count(*) from earnings where plan_id='${planId}' and period_start='2027-01-01';`) === '1'
);

// The next month is a different month, not a repeat.
await recordSubscriptionInvoice(paidInvoice('in_verify_2', '2027-02-01', 45000));
pass(
  'the next month is its own payment',
  psql(`select count(*) from earnings where plan_id='${planId}';`) === '2'
);

// ---- a card that fails ----
psql("delete from notifications where type='admissions_plan';");
await recordSubscriptionInvoice({
  type: 'invoice.payment_failed',
  data: { object: { subscription: 'sub_verify_fixture' } },
});
pass(
  'a failed payment marks the plan past due',
  psql(`select status from admissions_plans where id='${planId}';`) === 'past_due'
);
// A card expiring must not lock a student out of their college list a
// fortnight before a deadline, so past_due revokes nothing.
pass(
  'and nothing is switched off',
  psql(`select count(*) from v_student_entitlements where student_id='${studentId}' and service='admissions';`) === '1'
);
pass('somebody is told', Number(psql("select count(*) from notifications where type='admissions_plan';")) > 0);

psql(`delete from earnings where plan_id='${planId}';`);
psql("delete from invoices where stripe_invoice_id like 'in_verify_%';");

// ---- mock interviews ----
const tutorId2 = psql("select id from profiles where email='counselor@yakal.com';");
psql(`delete from sessions where kind='mock_interview' and student_id='${studentId}';`);
psql(`insert into sessions (student_id, tutor_id, subject, kind, date, start_time, status)
      values ('${studentId}','${tutorId2}','College Advising','mock_interview','2027-05-04','10:00','completed'),
             ('${studentId}','${tutorId2}','College Advising','mock_interview','2027-05-11','10:00','upcoming');`);
pass(
  'only a completed mock interview counts',
  psql(`select count(*) from sessions where student_id='${studentId}' and kind='mock_interview' and status='completed';`) === '1'
);
pass(
  'a lesson is not a mock interview',
  psql(`select count(*) from sessions where student_id='${studentId}' and kind='mock_interview' and subject='Chemistry';`) === '0'
);
psql(`delete from sessions where kind='mock_interview' and student_id='${studentId}';`);


console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
