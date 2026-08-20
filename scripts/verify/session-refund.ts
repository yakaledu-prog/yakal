// Cancelling a lesson gives real money back.
//
// Against Stripe test mode with no mocks: a real payment intent, confirmed with
// a real test card, producing a real charge, which is then really refunded. The
// policy arithmetic is checked exhaustively and offline in
// cancellation-policy.ts; what this checks is the part that only fails when
// money is involved.
//
//   the refund reaches Stripe, for the amount the preview promised
//   a purchase of several lessons refunds one lesson's share, not the lot
//   a late cancellation pays the tutor their half and refunds the rest
//   cancelling twice does not refund twice
//
// Not in `npm run check`. It moves money in the Stripe test account on every
// run. Run it when the cancellation or refund code changes:
//
//   npx tsx scripts/verify/session-refund.ts
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
//
// Running it several times in quick succession can fail with "Invalid or
// expired session" partway through: every handler call verifies the token with
// the local auth server, and GoTrue rate limits. Wait a moment and run it
// again rather than going looking for an auth bug.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const handler = (await import('../../api/_handlers/session-cancel.js')).default;
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
const studentId = psql(
  `select student_id from parent_student_links where parent_id='${parentId}' and status='active' limit 1;`
);

const anon = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
const { data: auth } = await anon.auth.signInWithPassword({
  email: 'parent@yakal.com',
  password: 'demo123',
});
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
  psql("delete from notifications where type='session_cancelled';");
  psql("delete from refunds where note like 'refund-fixture%' or session_id in (select id from sessions where subject like 'refund-fixture%');");
  psql("delete from earnings where session_id in (select id from sessions where subject like 'refund-fixture%');");
  psql("delete from sessions where subject like 'refund-fixture%';");
  psql("delete from invoices where description like 'refund-fixture%';");
};
clean();

// ---- a real payment ----
//
// Two lessons at $100 each, actually charged, so there is something to give
// back. A refund against an invented charge id proves nothing.

const intent = await stripe.paymentIntents.create({
  amount: 20_000,
  currency: 'usd',
  payment_method: 'pm_card_visa',
  confirm: true,
  automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  description: 'yakal refund-fixture',
});
pass('a real payment succeeds', intent.status === 'succeeded', intent.status);

const chargeId =
  typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge!.id;

const invoiceId = psql(
  `insert into invoices (parent_id, student_id, tutor_id, description, amount_cents, tutor_earning_cents, kind, status, stripe_charge_id, stripe_payment_intent_id, paid_at)
   values ('${parentId}','${studentId}','${tutorId}','refund-fixture purchase',20000,14000,'tutoring','paid','${chargeId}','${intent.id}', now())
   returning id;`
);

/** A lesson `h` hours from now, in the platform's zone. */
const makeSession = (label: string, hours: number) =>
  psql(
    `insert into sessions (student_id, tutor_id, invoice_id, subject, date, start_time, duration_minutes, status, tutor_earning_cents)
     select '${studentId}','${tutorId}','${invoiceId}','refund-fixture ${label}',(t)::date,(t)::time,60,'upcoming',7000
       from (select (now() at time zone 'America/New_York') + interval '${hours} hours' as t) s
     returning id;`
  );

const early = makeSession('early', 48);
const soon = makeSession('soon', 2);

try {
  // ---- the preview says what will happen ----

  const preview = await call({ sessionId: early, preview: true });
  pass('a cancellation can be previewed', preview.code === 200, JSON.stringify(preview.body));
  pass('and nothing has changed yet', psql(`select status from sessions where id='${early}';`) === 'upcoming');

  // One lesson's share of a two lesson purchase, not the whole thing.
  pass(
    'it refunds one lesson, not the purchase',
    preview.body?.refundCents === 10_000,
    String(preview.body?.refundCents)
  );
  pass('two days out, that is the full share', preview.body?.reason === 'in_notice', preview.body?.reason);
  pass('and the tutor earns nothing', preview.body?.tutorEarningCents === 0);

  // ---- cancelling in time ----

  const quoted = preview.body.refundCents;
  const done = await call({ sessionId: early, reason: 'refund-fixture in time' });
  pass('the lesson is cancelled', done.code === 200 && done.body?.cancelled, JSON.stringify(done.body));
  pass('the refund went through', !done.body?.refundError, done.body?.refundError ?? '');
  pass('for the amount quoted', done.body?.refundedCents === quoted, `${done.body?.refundedCents} vs ${quoted}`);
  pass('the session says cancelled', psql(`select status from sessions where id='${early}';`) === 'cancelled');

  // Stripe's own record, not ours.
  const refunds = await stripe.refunds.list({ charge: chargeId, limit: 10 });
  pass('Stripe has the refund', refunds.data.length === 1, String(refunds.data.length));
  pass(
    'for the same amount',
    refunds.data[0]?.amount === quoted,
    `${refunds.data[0]?.amount} vs ${quoted}`
  );
  pass('and it succeeded', refunds.data[0]?.status === 'succeeded', refunds.data[0]?.status ?? '');

  pass(
    'and it is recorded as being in notice',
    psql(`select reason from refunds where session_id='${early}';`) === 'in_notice'
  );

  // Telling somebody is deliberately not allowed to fail a cancellation, which
  // means a refused insert is a log line nobody reads while a tutor waits for a
  // student who is not coming. So it is asserted rather than assumed.
  pass(
    'and the tutor is told',
    psql(
      `select count(*) from notifications where user_id='${tutorId}' and type='session_cancelled' and created_at > now() - interval '2 minutes';`
    ) !== '0'
  );

  // ---- asking twice ----
  //
  // A double-click, a retried request, or a parent on a flaky connection. The
  // money must go back once.

  const again = await call({ sessionId: early, reason: 'refund-fixture twice' });
  pass('cancelling again is refused', again.code === 400, JSON.stringify(again.body));
  pass(
    'and Stripe still has exactly one refund',
    (await stripe.refunds.list({ charge: chargeId, limit: 10 })).data.length === 1
  );

  // ---- cancelling late ----

  const latePreview = await call({ sessionId: soon, preview: true });
  pass('two hours out is a late cancellation', latePreview.body?.reason === 'late', latePreview.body?.reason);
  pass('half comes back', latePreview.body?.refundCents === 5_000, String(latePreview.body?.refundCents));
  pass(
    'and the tutor keeps half their share',
    latePreview.body?.tutorEarningCents === 3_500,
    String(latePreview.body?.tutorEarningCents)
  );

  const lateDone = await call({ sessionId: soon, reason: 'refund-fixture late' });
  pass('it goes through', lateDone.code === 200 && lateDone.body?.cancelled, JSON.stringify(lateDone.body));
  pass('refunding half', lateDone.body?.refundedCents === 5_000, String(lateDone.body?.refundedCents));

  // The tutor held the hour and could not fill it, which is what the fee is
  // for, so they are owed their half of it.
  const earning = psql(
    `select coalesce(amount_cents::text || '/' || status, 'none') from earnings where session_id='${soon}' and voided_at is null;`
  );
  pass('the tutor is owed their half of the fee', earning === '3500/pending', earning);

  // Nobody is paid for the one cancelled in time.
  pass(
    'and nothing at all for the one cancelled in time',
    psql(`select coalesce(string_agg(status, ','), 'none') from earnings where session_id='${early}' and voided_at is null;`) === 'none'
  );

  const total = (await stripe.refunds.list({ charge: chargeId, limit: 10 })).data.reduce(
    (n, r) => n + r.amount,
    0
  );
  pass('the two refunds together never exceed the payment', total <= 20_000, `${total} of 20000`);

  // ---- somebody else's lesson ----

  const stranger = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
  const { data: strangerAuth } = await stranger.auth.signInWithPassword({
    email: 'yared.mekonnen@yakal.demo',
    password: 'demo123',
  });
  const third = makeSession('stranger', 72);
  const refused = await call({ sessionId: third, preview: true }, strangerAuth!.session!.access_token);
  pass('a stranger cannot cancel it', refused.code === 403, JSON.stringify(refused.body));
} finally {
  clean();
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
