// Refunding after somebody has already been paid.
//
// This is the case the whole ledger design is arranged around, and the one
// worth checking with real money rather than reasoning about.
//
// A refund is cheap while the money sits in the platform balance: the earning
// is still pending, it is cancelled along with the refund, and nobody is out of
// pocket. Once that earning has settled the money is in a tutor's account for
// work they actually did, refunding the family does not take it back, and no
// button here can. The only honest thing to do is say so before the admin
// decides, which is what the preview is for.
//
// Not in `npm run check`: it moves money in the Stripe test account.
//
//   npx tsx scripts/verify/admin-refund.ts
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const handler = (await import('../../api/_handlers/admin-refund.js')).default;
const { getStripe } = await import('../../api/_utils/billing.js');

const psql = (sql: string) =>
  execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "${sql}"`)
    .toString()
    .trim();

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const stripe = getStripe();

const parentId = psql("select id from profiles where email='parent@yakal.com';");
const tutorId = psql("select id from profiles where email='tutor@yakal.com';");
const adminEmail = psql("select email from profiles where role='admin' order by created_at limit 1;");
const studentId = psql(
  `select student_id from parent_student_links where parent_id='${parentId}' and status='active' limit 1;`
);

const anon = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await anon.auth.signInWithPassword({
  email: adminEmail,
  password: 'demo123',
});
pass('an admin signs in', !authErr, authErr?.message ?? adminEmail);
const token = auth!.session!.access_token;

async function call(body: Record<string, unknown>, asToken = token) {
  let out: any;
  const res: any = {
    status(c: number) {
      this._c = c;
      return this;
    },
    json(b: any) {
      out = { code: this._c, body: b };
      return this;
    },
    end() {
      return this;
    },
  };
  await handler(
    { method: 'POST', headers: { authorization: `Bearer ${asToken}` }, body } as any,
    res
  );
  return out;
}

const clean = () => {
  psql("delete from refunds where invoice_id in (select id from invoices where description like 'admin-refund-fixture%');");
  psql("delete from earnings where session_id in (select id from sessions where subject like 'admin-refund-fixture%');");
  psql("delete from sessions where subject like 'admin-refund-fixture%';");
  psql("delete from invoices where description like 'admin-refund-fixture%';");
};
clean();

/** A real payment, so there is something to give back. */
async function paidInvoice(label: string, amountCents: number) {
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    description: `yakal admin-refund-fixture ${label}`,
  });
  const chargeId =
    typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge!.id;

  const id = psql(
    `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status, stripe_charge_id, stripe_payment_intent_id, paid_at)
     values ('${parentId}','${studentId}','${tutorId}','admin-refund-fixture ${label}',${amountCents},${Math.floor(amountCents * 0.7)},'tutoring','paid','${chargeId}','${intent.id}', now())
     returning id;`
  );
  return { id, chargeId };
}

/** A delivered lesson with an earning against it, in whichever state. */
function earningFor(
  invoiceId: string,
  chargeId: string,
  label: string,
  status: 'pending' | 'settled',
  // One student cannot be in two places at once, and a unique index says so.
  // Each fixture gets its own hour.
  hour: string
) {
  const sessionId = psql(
    `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents)
     values ('${studentId}','${tutorId}','${invoiceId}','admin-refund-fixture ${label}','2026-08-01','${hour}',60,'completed',7000)
     returning id;`
  );
  // The receipt goes in with the row, not after it. earnings_settled_has_receipt
  // refuses a row that claims to be paid without saying how, which is the point
  // of the constraint and is worth respecting rather than working around.
  const receipt =
    status === 'settled'
      ? ", 'stripe_connect', 'tr_fixture_' || gen_random_uuid()::text, now()"
      : ', null, null, null';

  psql(
    `insert into earnings (payee_id, kind, session_id, invoice_id, source_charge_id, amount_cents, status, releasable_at, method, reference, settled_at)
     values ('${tutorId}','tutoring_session','${sessionId}','${invoiceId}','${chargeId}',7000,'${status}', now()${receipt});`
  );
  return sessionId;
}

try {
  // ---- nothing paid out yet: the cheap case ----

  const cheap = await paidInvoice('cheap', 10_000);
  earningFor(cheap.id, cheap.chargeId, 'cheap', 'pending', '10:00');

  const cheapPreview = await call({ invoiceId: cheap.id, preview: true });
  pass('a refund can be previewed', cheapPreview.code === 200, JSON.stringify(cheapPreview.body));
  pass('the whole payment is refundable', cheapPreview.body?.amountCents === 10_000, String(cheapPreview.body?.amountCents));
  pass(
    'and it costs the platform nothing extra',
    cheapPreview.body?.alreadyPaidOutCents === 0,
    String(cheapPreview.body?.alreadyPaidOutCents)
  );
  pass('nothing has moved yet', psql(`select count(*) from refunds where invoice_id='${cheap.id}';`) === '0');

  const cheapDone = await call({ invoiceId: cheap.id, note: 'goodwill' });
  pass('the refund goes through', cheapDone.body?.refunded === true, JSON.stringify(cheapDone.body));
  pass(
    'and the pending earning is cancelled with it',
    cheapDone.body?.earningsCancelled === 1,
    String(cheapDone.body?.earningsCancelled)
  );
  pass('so nothing was absorbed', cheapDone.body?.earningsAlreadyPaid === 0);
  pass(
    'the tutor is owed nothing for it now',
    psql(`select status from earnings where invoice_id='${cheap.id}';`) === 'cancelled'
  );

  const stripeRefunds = await stripe.refunds.list({ charge: cheap.chargeId, limit: 5 });
  pass('Stripe agrees it happened', stripeRefunds.data[0]?.amount === 10_000, String(stripeRefunds.data[0]?.amount));

  // A second refund cannot exceed what is left, which is nothing.
  const twice = await call({ invoiceId: cheap.id, preview: true });
  pass('nothing is left to refund', twice.body?.refundable === 0, String(twice.body?.refundable));
  const twiceDone = await call({ invoiceId: cheap.id });
  pass('and a second refund is refused', twiceDone.code === 400, JSON.stringify(twiceDone.body));

  // ---- already paid out: the expensive case ----
  //
  // The reason the preview exists. Nothing here can recover money that is in
  // somebody's account for work they did, so the number is shown instead.

  const dear = await paidInvoice('dear', 10_000);
  earningFor(dear.id, dear.chargeId, 'dear', 'settled', '12:00');

  const dearPreview = await call({ invoiceId: dear.id, preview: true });
  pass(
    'a refund after payout says what it costs',
    dearPreview.body?.alreadyPaidOutCents === 7_000,
    String(dearPreview.body?.alreadyPaidOutCents)
  );
  pass('and how many payments that is', dearPreview.body?.alreadyPaidOutCount === 1, String(dearPreview.body?.alreadyPaidOutCount));

  const dearDone = await call({ invoiceId: dear.id, note: 'complaint' });
  pass('it still goes through', dearDone.body?.refunded === true, JSON.stringify(dearDone.body));
  pass(
    'and reports what could not be recovered',
    dearDone.body?.earningsAlreadyPaid === 1,
    String(dearDone.body?.earningsAlreadyPaid)
  );

  // The settled row is left alone. Marking it cancelled would say the money
  // came back, and it did not.
  pass(
    'the settled earning is untouched',
    psql(`select status from earnings where invoice_id='${dear.id}';`) === 'settled'
  );

  // ---- who may do it ----

  const parent = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
  const { data: parentAuth } = await parent.auth.signInWithPassword({
    email: 'parent@yakal.com',
    password: 'demo123',
  });
  const refused = await call({ invoiceId: dear.id, preview: true }, parentAuth!.session!.access_token);
  pass('a parent cannot refund themselves', refused.code === 403, JSON.stringify(refused.body));
} finally {
  clean();
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
