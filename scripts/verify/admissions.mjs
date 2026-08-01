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

const createInvoice = (await import('../../api/create-invoice.ts')).default;
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
const { fulfilInvoices } = await import('../../api/utils/fulfil.ts');
await fulfilInvoices(db, [invoiceId]);

pass(
  'the student is on the tier',
  psql(`select count(*) from admissions_plans where student_id='${studentId}' and tier_id='${premierId}' and status='active';`) === '1'
);
pass(
  'admissions is switched on for them',
  psql(`select is_active from child_services where student_id='${studentId}' and service='admissions';`) === 't'
);
pass('both are told', psql("select count(*) from notifications where type='admissions_plan';") === '2');

const mail = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
pass('two emails go out', mail.total === 2, `total=${mail.total}`);

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
  'the old plan is kept, ended',
  psql(`select count(*) from admissions_plans where student_id='${studentId}' and status='ended' and tier_id='${premierId}';`) === '1'
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

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
