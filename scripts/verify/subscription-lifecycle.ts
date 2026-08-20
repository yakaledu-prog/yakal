// Upgrading, downgrading and cancelling a counselling subscription, for real.
//
// Against Stripe test mode, through the actual handler, with no mocks: a real
// customer, a real card, a real subscription, and Stripe's own answers about
// what happened to it. The arithmetic of proration and period ends is Stripe's
// and there is no point asserting our idea of it, so what this pins is the part
// that is ours to get wrong:
//
//   an upgrade applies now and bills the difference now
//   a downgrade applies at the period end and bills nothing now
//   a cancellation leaves them everything until the period end
//   the plan row ends up saying the same thing Stripe does
//
// Not in `npm run check`. It creates objects in the Stripe test account every
// run and takes a few seconds, which is the wrong trade for something that runs
// before every commit. Run it when the subscription code changes:
//
//   npx tsx scripts/verify/subscription-lifecycle.ts
//
// Needs the local Supabase, the seeded accounts, and STRIPE_SECRET_KEY.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const handler = (await import('../../api/_handlers/subscription.js')).default;
const { getStripe } = await import('../../api/_utils/billing.js');
const { priceForTier } = await import('../../api/_utils/subscriptions.js');
const { getServiceClient } = await import('../../api/_utils/supabase.js');

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
const db = getServiceClient();

const parentId = psql("select id from profiles where email='parent@yakal.com';");
const studentId = psql(
  `select student_id from parent_student_links where parent_id='${parentId}' and status='active' limit 1;`
);

const anon = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
const { data: auth } = await anon.auth.signInWithPassword({
  email: 'parent@yakal.com',
  password: 'demo123',
});
const token = auth!.session!.access_token;

async function call(body: Record<string, unknown>) {
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
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body } as any, res);
  return out;
}

// ---- two real tiers to move between ----

const cheapId = psql("select id from admissions_tiers where key='essential';");
const dearId = psql("select id from admissions_tiers where key='elite';");
const { data: cheap } = await db.from('admissions_tiers').select('id, name, price_cents, stripe_price_id').eq('id', cheapId).single();
const { data: dear } = await db.from('admissions_tiers').select('id, name, price_cents, stripe_price_id').eq('id', dearId).single();

const cheapPrice = await priceForTier(db, cheap!);
const dearPrice = await priceForTier(db, dear!);
pass('each tier has a real Stripe price', !!cheapPrice && !!dearPrice, `${cheapPrice}, ${dearPrice}`);

// Asking twice returns the same one rather than making a second, so a busy
// afternoon of checkouts does not litter the account with duplicate prices.
pass('and asking again reuses it', (await priceForTier(db, { ...cheap!, stripe_price_id: cheapPrice })) === cheapPrice);

// ---- a subscribed family ----

const customer = await stripe.customers.create({
  description: 'yakal subscription-lifecycle fixture',
  // Stripe's always-succeeds test card, attached without a card form.
  payment_method: 'pm_card_visa',
  invoice_settings: { default_payment_method: 'pm_card_visa' },
});

const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: cheapPrice }],
  payment_behavior: 'error_if_incomplete',
});
pass('a subscription starts on the cheaper tier', sub.status === 'active', sub.status);

psql("delete from admissions_plans where student_id='" + studentId + "' and stripe_subscription_id like 'sub_%lifecycle%';");
const planId = psql(
  `insert into admissions_plans (student_id, purchased_by, tier_id, counselor_id, status, stripe_subscription_id)
   values ('${studentId}','${parentId}','${cheapId}', null, 'active', '${sub.id}')
   on conflict (student_id) where status in ('active','past_due')
   do update set tier_id='${cheapId}', stripe_subscription_id='${sub.id}', pending_tier_id=null, stripe_schedule_id=null, cancel_at_period_end=false
   returning id;`
);

const cleanup = async () => {
  await stripe.subscriptions.cancel(sub.id).catch(() => undefined);
  await stripe.customers.del(customer.id).catch(() => undefined);
  psql(`delete from admissions_plans where id='${planId}';`);
};

try {
  // ---- what it will cost, before it costs it ----
  //
  // The figure on the confirmation screen is what the customer agrees to, so
  // the only assertion worth making about it is that it turns out to be true.

  const preview = await call({ planId, tierId: dearId, op: 'preview' });
  pass('an upgrade can be previewed', preview.code === 200, JSON.stringify(preview.body));
  pass('and is named as an upgrade', preview.body?.direction === 'upgrade', JSON.stringify(preview.body));
  pass(
    'with something to pay today',
    (preview.body?.dueNowCents ?? 0) > 0,
    String(preview.body?.dueNowCents)
  );
  // Prorated, so never more than a full month at the new rate.
  pass(
    'and never more than a month at the new rate',
    (preview.body?.dueNowCents ?? 0) <= dear!.price_cents,
    `${preview.body?.dueNowCents} vs ${dear!.price_cents}`
  );

  // ---- upgrading ----

  const before = (await stripe.invoices.list({ customer: customer.id, limit: 100 })).data.length;
  const quotedCents = preview.body?.dueNowCents ?? 0;
  const up = await call({ planId, tierId: dearId, op: 'change' });

  pass('an upgrade is accepted', up.code === 200, JSON.stringify(up.body));
  pass('and applies immediately', up.body?.applied === 'now', JSON.stringify(up.body));

  const afterUpgrade = await stripe.subscriptions.retrieve(sub.id);
  pass(
    'the subscription is on the dearer price',
    afterUpgrade.items.data[0].price.id === dearPrice
  );

  // always_invoice rather than the default, so the difference is billed now
  // instead of appearing on next month's invoice.
  const invoicesAfter = (await stripe.invoices.list({ customer: customer.id, limit: 100 })).data;
  pass('and the difference is billed now, not next month', invoicesAfter.length > before, `${before} -> ${invoicesAfter.length}`);

  // The whole point of the preview. A quote that does not match the charge is
  // worse than no quote, because the customer agreed to the quote.
  //
  // A cent of tolerance: proration is computed per second, and a moment passes
  // between quoting and charging. At a monthly price that is a fraction of a
  // cent, but exact equality would make this fail on a slow afternoon.
  const charged = invoicesAfter[0]?.amount_due ?? 0;
  pass(
    'and the amount charged is the amount quoted',
    Math.abs(charged - quotedCents) <= 1,
    `quoted ${quotedCents}, charged ${charged}`
  );

  pass(
    'the plan row followed',
    psql(`select tier_id from admissions_plans where id='${planId}';`) === dearId
  );

  // ---- downgrading ----

  const downPreview = await call({ planId, tierId: cheapId, op: 'preview' });
  pass(
    'a downgrade previews as costing nothing today',
    downPreview.body?.direction === 'downgrade' && downPreview.body?.dueNowCents === 0,
    JSON.stringify(downPreview.body)
  );
  pass('and says when it starts', !!downPreview.body?.startsAt, JSON.stringify(downPreview.body));

  const invoicesBeforeDown = (await stripe.invoices.list({ customer: customer.id, limit: 100 })).data.length;
  const down = await call({ planId, tierId: cheapId, op: 'change' });

  pass('a downgrade is accepted', down.code === 200, JSON.stringify(down.body));
  pass('and waits for the period end', down.body?.applied === 'period_end', JSON.stringify(down.body));

  // Nothing is charged and nothing is refunded: they keep what they paid for.
  const invoicesAfterDown = (await stripe.invoices.list({ customer: customer.id, limit: 100 })).data.length;
  pass('nothing is billed or refunded for it', invoicesAfterDown === invoicesBeforeDown);

  const stillDear = await stripe.subscriptions.retrieve(sub.id);
  pass('and they keep the tier they paid for until then', stillDear.items.data[0].price.id === dearPrice);

  const scheduleId = psql(`select stripe_schedule_id from admissions_plans where id='${planId}';`);
  pass('a schedule holds the change', !!scheduleId, scheduleId || 'none');
  pass(
    'and the plan says which tier is coming',
    psql(`select pending_tier_id from admissions_plans where id='${planId}';`) === cheapId
  );

  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  pass('the second phase is the cheaper price', schedule.phases[1]?.items?.[0]?.price === cheapPrice);
  // release, so the subscription carries on renewing after the switch instead
  // of stopping when the schedule runs out.
  pass('and the subscription is handed back afterwards', schedule.end_behavior === 'release');

  // Asking again updates the schedule that is already there. Stripe refuses a
  // second schedule on one subscription outright, so this is the difference
  // between a parent pressing the button twice and a 500.
  const again = await call({ planId, tierId: cheapId, op: 'change' });
  pass('asking for the same downgrade twice still works', again.code === 200, JSON.stringify(again.body));
  pass(
    'and does not make a second schedule',
    psql(`select stripe_schedule_id from admissions_plans where id='${planId}';`) === scheduleId
  );

  // Changing their mind and wanting to stay. They are nominally on the dearer
  // tier already, so this used to be refused as "already on that plan", which
  // was true and useless: the downgrade would still have landed with no way
  // left to stop it.
  const stay = await call({ planId, tierId: dearId, op: 'change' });
  pass('asking to stay cancels the pending downgrade', stay.code === 200, JSON.stringify(stay.body));
  pass(
    'and nothing is waiting to change any more',
    psql(`select coalesce(pending_tier_id::text, 'none') from admissions_plans where id='${planId}';`) === 'none'
  );

  // Now a genuine upgrade with a schedule in the way. Stripe refuses to let a
  // subscription be edited while a schedule owns it, so this is the path that
  // has to release one first, and the only way to find that out is to try.
  //
  // It needs the family on the middle tier, because an upgrade out of the
  // dearest one does not exist. Moved directly rather than through the handler:
  // this is setting up the case, not part of what is being tested.
  const middleId = psql("select id from admissions_tiers where key='premier';");
  const { data: middle } = await db
    .from('admissions_tiers')
    .select('id, name, price_cents, stripe_price_id')
    .eq('id', middleId)
    .single();
  const middlePrice = await priceForTier(db, middle!);

  const reset = await stripe.subscriptions.retrieve(sub.id);
  await stripe.subscriptions.update(sub.id, {
    items: [{ id: reset.items.data[0].id, price: middlePrice }],
    proration_behavior: 'none',
  });
  psql(
    `update admissions_plans set tier_id='${middleId}', pending_tier_id=null, stripe_schedule_id=null where id='${planId}';`
  );

  await call({ planId, tierId: cheapId, op: 'change' });
  pass(
    'a downgrade is pending again',
    psql(`select coalesce(stripe_schedule_id, 'none') from admissions_plans where id='${planId}';`) !== 'none'
  );

  const jump = await call({ planId, tierId: dearId, op: 'change' });
  pass('a real upgrade works with a schedule in the way', jump.code === 200, JSON.stringify(jump.body));
  pass('and applies immediately', jump.body?.applied === 'now', JSON.stringify(jump.body));
  pass(
    'the schedule is gone',
    psql(`select coalesce(stripe_schedule_id, 'none') from admissions_plans where id='${planId}';`) === 'none'
  );

  // ---- cancelling ----

  const cancelled = await call({ planId, op: 'cancel' });
  pass('a cancellation is accepted', cancelled.code === 200, JSON.stringify(cancelled.body));
  pass('and is set for the period end', cancelled.body?.cancelAtPeriodEnd === true);

  const afterCancel = await stripe.subscriptions.retrieve(sub.id);
  pass('Stripe agrees', afterCancel.cancel_at_period_end === true);
  pass('the subscription is still live meanwhile', afterCancel.status === 'active', afterCancel.status);
  pass(
    'the plan says so too',
    psql(`select cancel_at_period_end from admissions_plans where id='${planId}';`) === 't'
  );

  // Cancelling wins over a pending downgrade: switching somebody's tier on
  // their way out is not a thing anybody wants.
  pass(
    'and the pending downgrade is dropped',
    psql(`select coalesce(stripe_schedule_id, 'none') from admissions_plans where id='${planId}';`) === 'none'
  );

  // ---- changing their mind ----

  const resumed = await call({ planId, op: 'resume' });
  pass('a cancellation can be undone', resumed.code === 200, JSON.stringify(resumed.body));
  pass(
    'and Stripe stops planning to end it',
    (await stripe.subscriptions.retrieve(sub.id)).cancel_at_period_end === false
  );

  // ---- somebody else's subscription ----

  const stranger = createClient('http://127.0.0.1:54321', ANON, { auth: { persistSession: false } });
  const { data: strangerAuth } = await stranger.auth.signInWithPassword({
    email: 'tutor@yakal.com',
    password: 'demo123',
  });
  let out: any;
  const res: any = {
    status(c: number) { this._c = c; return this; },
    json(b: any) { out = { code: this._c, body: b }; return this; },
    end() { return this; },
  };
  await handler(
    {
      method: 'POST',
      headers: { authorization: `Bearer ${strangerAuth!.session!.access_token}` },
      body: { planId, op: 'cancel' },
    } as any,
    res
  );
  pass('a stranger cannot cancel it', out.code === 403, JSON.stringify(out.body));
} finally {
  await cleanup();
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
