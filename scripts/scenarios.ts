/**
 * Money states, built on demand, so the whole chain can be looked at tonight.
 *
 *   npm run scenarios build         every state at once
 *   npm run scenarios fast-forward  make booked lessons have happened
 *   npm run scenarios release       expire every hold and pay what is payable
 *   npm run scenarios status        what exists now
 *   npm run scenarios clear         remove everything this made
 *
 * ---
 *
 * The problem this solves is time. A lesson has to finish before anybody earns,
 * an earning waits 72 hours before it moves, and a counselling month waits for
 * the month. Testing that honestly would take four days per case, so nothing
 * downstream of "the parent paid" ever gets looked at.
 *
 * It also solves the clock. tutor_availability is thirteen rows starting at
 * 8 AM (the booking function reads `hour - 8`), so 1 AM is not a slot that can
 * exist and no amount of opening availability creates one. Book at any hour the
 * tutor offers, on any future date, then `fast-forward` moves it into the past.
 * That is the intended way round: the UI stays honest, the data moves.
 *
 * Everything made here is tagged and `clear` removes exactly that, so it can sit
 * alongside the seed without confusing it.
 *
 * Local only, and not overridable. This writes invoices, refunds and settled
 * earnings, which are claims that money moved. None of that belongs in a real
 * ledger, and a --target=remote flag would eventually get typed by accident.
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

/** Written into every row this creates, and the only thing `clear` deletes on. */
const TAG = '[scenario]';

const URL_LOCAL = process.env.VITE_SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321';
const KEY_LOCAL =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

if (!/localhost|127\.0\.0\.1/.test(URL_LOCAL)) {
  console.error('\nThis only ever runs against the local stack. Nothing was changed.\n');
  process.exit(1);
}

const db = createClient(URL_LOCAL, KEY_LOCAL, { auth: { persistSession: false } });

/**
 * A real charge in Stripe test mode, so the money is real enough to move.
 *
 * The first version of this invented charge ids like `ch_scenario_held`. Every
 * transfer then failed with "No such charge", because releasing an earning
 * passes source_transaction to draw on the charge that funded it. An invented
 * id also means a refund cannot be tested at all, which is half the point.
 *
 * tok_bypassPending settles immediately, so the platform balance can cover the
 * transfer in the same run rather than days later.
 *
 * Returns null if Stripe is not configured. Everything still builds; transfers
 * then draw on the platform balance instead, and refunds cannot be exercised.
 */
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

let warnedNoStripe = false;

async function realCharge(amountCents: number, description: string): Promise<string | null> {
  if (!stripe) {
    if (!warnedNoStripe) {
      console.log('  (no STRIPE_SECRET_KEY, so charges are not created and refunds cannot be tested)');
      warnedNoStripe = true;
    }
    return null;
  }
  try {
    const charge = await stripe.charges.create({
      amount: amountCents,
      currency: 'usd',
      source: 'tok_bypassPending',
      description: `${TAG} ${description}`,
    });
    return charge.id;
  } catch (err: any) {
    console.log(`  (Stripe refused a charge for ${description}: ${err?.message})`);
    return null;
  }
}

const hours = (n: number) => n * 3600_000;
const days = (n: number) => n * 86_400_000;
const at = (ms: number) => new Date(Date.now() + ms);
const iso = (ms: number) => at(ms).toISOString();
const dateOf = (ms: number) => at(ms).toISOString().slice(0, 10);
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

async function person(email: string): Promise<string> {
  const { data } = await db.from('profiles').select('id').eq('email', email).single();
  if (!data) throw new Error(`No account for ${email}. Run npm run db:reset first.`);
  return data.id;
}

/** Students with no live plan, since admissions_plans_one_live allows only one each. */
async function freeStudents(howMany: number): Promise<string[]> {
  const { data: taken } = await db
    .from('admissions_plans')
    .select('student_id')
    .in('status', ['active', 'past_due']);
  const busy = new Set((taken ?? []).map((r: any) => r.student_id));

  const { data: all } = await db.from('profiles').select('id').eq('role', 'student');
  const free = (all ?? []).map((r: any) => r.id).filter((id: string) => !busy.has(id));

  if (free.length < howMany) {
    throw new Error(
      `Needs ${howMany} students with no live plan, found ${free.length}. Try npm run scenarios clear, or npm run db:reset.`
    );
  }
  return free.slice(0, howMany);
}

// ------------------------------------------------------------
// build
// ------------------------------------------------------------

interface Cast {
  tutor: string;
  counselor: string;
  parent: string;
  student: string;
  coursePrice: number;
  tutorShare: number;
  tierId: string;
  tierPrice: number;
  tierShare: number;
}

async function makeInvoice(c: Cast, label: string, amount: number, share: number, status = 'paid') {
  const chargeId = status === 'paid' ? await realCharge(amount, label) : null;
  const { data, error } = await db
    .from('invoices')
    .insert({
      parent_id: c.parent,
      student_id: c.student,
      tutor_id: c.tutor,
      description: `${TAG} ${label}`,
      amount_cents: amount,
      tutor_earning_cents: share,
      kind: 'tutoring',
      status,
      paid_at: status === 'paid' ? iso(-days(1)) : null,
      stripe_charge_id: chargeId,
    })
    .select('id, stripe_charge_id')
    .single();
  if (error) throw new Error(`invoice ${label}: ${error.message}`);
  return data as { id: string; stripe_charge_id: string | null };
}

async function makeSession(
  c: Cast,
  label: string,
  invoiceId: string | null,
  offsetMs: number,
  status: string,
  share: number,
  extra: Record<string, unknown> = {}
) {
  const { data, error } = await db
    .from('sessions')
    .insert({
      student_id: c.student,
      tutor_id: c.tutor,
      invoice_id: invoiceId,
      subject: `${TAG} ${label}`,
      date: dateOf(offsetMs),
      // Kept inside the tutor's real hours so the row looks like something the
      // booking function would have produced.
      start_time: '10:00',
      duration_minutes: 60,
      status,
      kind: 'lesson',
      tutor_earning_cents: share,
      ...extra,
    })
    .select('id')
    .single();
  if (error) throw new Error(`session ${label}: ${error.message}`);
  return data.id as string;
}

async function makeEarning(row: Record<string, unknown>) {
  const { error } = await db.from('earnings').insert({ note: `${TAG}`, ...row });
  if (error) throw new Error(`earning: ${error.message}`);
}

async function build() {
  const [tutor, counselor, parent, student] = await Promise.all([
    person('tutor@yakal.com'),
    person('counselor@yakal.com'),
    person('parent@yakal.com'),
    person('student@yakal.com'),
  ]);

  // Real figures, read rather than invented, so the screens show plausible money.
  const { data: course } = await db
    .from('courses')
    .select('price_cents, tutor_payout_cents')
    .not('price_cents', 'is', null)
    .order('price_cents')
    .limit(1)
    .single();
  const { data: tier } = await db
    .from('admissions_tiers')
    .select('id, price_cents, counselor_share_percent')
    .order('sort_order')
    .limit(1)
    .single();

  const coursePrice = course?.price_cents ?? 6000;
  const tutorShare = course?.tutor_payout_cents ?? Math.round(coursePrice * 0.7);
  const tierPrice = tier?.price_cents ?? 12000;
  const tierShare = Math.round((tierPrice * Number(tier?.counselor_share_percent ?? 40)) / 100);

  const c: Cast = {
    tutor, counselor, parent, student,
    coursePrice, tutorShare,
    tierId: tier!.id, tierPrice, tierShare,
  };

  console.log('\nBuilding money states\n');

  // ---- tutoring ----

  // Bought and not yet taught. Nothing is owed to anybody.
  const inv1 = await makeInvoice(c, 'upcoming lesson', coursePrice, tutorShare);
  await makeSession(c, 'upcoming lesson', inv1.id, days(3), 'upcoming', tutorShare);
  console.log(`  upcoming            paid ${usd(coursePrice)}, nothing earned yet`);

  // Taught an hour ago. Earned, and inside its hold.
  const inv2 = await makeInvoice(c, 'held lesson', coursePrice, tutorShare);
  const s2 = await makeSession(c, 'held lesson', inv2.id, -hours(2), 'completed', tutorShare, {
    completed_at: iso(-hours(1)),
  });
  await makeEarning({
    payee_id: tutor, kind: 'tutoring_session', session_id: s2, invoice_id: inv2.id,
    amount_cents: tutorShare, status: 'pending', releasable_at: iso(hours(70)),
    source_charge_id: inv2.stripe_charge_id,
  });
  console.log(`  held                ${usd(tutorShare)} owed, releases in ~3 days`);

  // Past its hold with nowhere to send it. This is the admin Owed queue.
  const inv3 = await makeInvoice(c, 'due lesson', coursePrice, tutorShare);
  const s3 = await makeSession(c, 'due lesson', inv3.id, -days(5), 'completed', tutorShare, {
    completed_at: iso(-days(5)),
  });
  await makeEarning({
    payee_id: tutor, kind: 'tutoring_session', session_id: s3, invoice_id: inv3.id,
    amount_cents: tutorShare, status: 'pending', releasable_at: iso(-days(2)),
    source_charge_id: inv3.stripe_charge_id,
  });
  console.log(`  due                 ${usd(tutorShare)} owed, hold expired`);

  // Already paid, both ways. The two rails are what the tax screen tells apart.
  const inv4 = await makeInvoice(c, 'paid by stripe', coursePrice, tutorShare);
  const s4 = await makeSession(c, 'paid by stripe', inv4.id, -days(20), 'completed', tutorShare, {
    completed_at: iso(-days(20)),
  });
  await makeEarning({
    payee_id: tutor, kind: 'tutoring_session', session_id: s4, invoice_id: inv4.id,
    amount_cents: tutorShare, status: 'settled', releasable_at: iso(-days(17)),
    method: 'stripe_connect', reference: 'tr_scenario_example', settled_at: iso(-days(17)),
  });
  console.log(`  settled by Stripe   ${usd(tutorShare)}`);

  const inv5 = await makeInvoice(c, 'paid by ach', coursePrice, tutorShare);
  const s5 = await makeSession(c, 'paid by ach', inv5.id, -days(25), 'completed', tutorShare, {
    completed_at: iso(-days(25)),
  });
  await makeEarning({
    payee_id: tutor, kind: 'tutoring_session', session_id: s5, invoice_id: inv5.id,
    amount_cents: tutorShare, status: 'settled', releasable_at: iso(-days(22)),
    method: 'ach', reference: 'ACH-SCENARIO-0001', settled_at: iso(-days(22)),
  });
  console.log(`  settled by ACH      ${usd(tutorShare)}  <- invisible to Stripe's 1099 draft`);

  // Cancelled in notice: everything back, tutor earns nothing.
  const inv6 = await makeInvoice(c, 'cancelled in notice', coursePrice, tutorShare);
  const s6 = await makeSession(c, 'cancelled in notice', inv6.id, days(4), 'cancelled', tutorShare, {
    cancelled_at: iso(-hours(3)), cancel_reason: 'Something came up',
  });
  // Refunded in Stripe too, not just recorded here, so the parent's billing page
  // and Stripe agree and the refund can be looked at on both sides.
  const refund6 = inv6.stripe_charge_id
    ? await stripe!.refunds.create({ charge: inv6.stripe_charge_id }).catch(() => null)
    : null;
  await db.from('refunds').insert({
    invoice_id: inv6.id, session_id: s6, amount_cents: coursePrice,
    reason: 'in_notice', status: 'succeeded', stripe_refund_id: refund6?.id ?? null,
  });
  console.log(`  refunded in full    ${usd(coursePrice)} back, tutor earns nothing`);

  // Cancelled late: half kept, and the tutor keeps half of their share.
  const inv7 = await makeInvoice(c, 'cancelled late', coursePrice, tutorShare);
  const lateRefund = Math.ceil(coursePrice / 2);
  const lateShare = Math.floor(tutorShare / 2);
  const s7 = await makeSession(c, 'cancelled late', inv7.id, hours(6), 'cancelled', tutorShare, {
    cancelled_at: iso(-hours(1)), cancel_reason: 'Child is unwell',
  });
  const refund7 = inv7.stripe_charge_id
    ? await stripe!.refunds.create({ charge: inv7.stripe_charge_id, amount: lateRefund }).catch(() => null)
    : null;
  await db.from('refunds').insert({
    invoice_id: inv7.id, session_id: s7, amount_cents: lateRefund,
    reason: 'late', status: 'succeeded', stripe_refund_id: refund7?.id ?? null,
  });
  // Half the share, and it may still be transferred: the charge behind it was
  // only half refunded, so there is money left on it to draw against.
  await makeEarning({
    payee_id: tutor, kind: 'tutoring_session', session_id: s7, invoice_id: inv7.id,
    amount_cents: lateShare, status: 'pending', releasable_at: iso(hours(70)),
    source_charge_id: inv7.stripe_charge_id,
  });
  console.log(`  refunded half       ${usd(lateRefund)} back, tutor keeps ${usd(lateShare)}`);

  // Billed, and nobody came.
  const inv8 = await makeInvoice(c, 'no show', coursePrice, tutorShare);
  await makeSession(c, 'no show', inv8.id, -days(2), 'no-show', tutorShare, {
    attendance: [], attendance_checked_at: iso(-days(2)),
  });
  console.log(`  no-show             billed, nobody joined, nothing paid`);

  // An invoice nobody ever paid.
  await makeInvoice(c, 'abandoned checkout', coursePrice, tutorShare, 'open');
  console.log(`  unpaid              ${usd(coursePrice)} open`);

  // ---- counselling ----
  const [sA, sB, sC] = await freeStudents(3);

  const plan = async (student: string, label: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await db
      .from('admissions_plans')
      .insert({
        student_id: student, purchased_by: parent, tier_id: c.tierId,
        counselor_id: counselor, status: 'active',
        stripe_subscription_id: `sub_scenario_${label}`,
        ...extra,
      })
      .select('id')
      .single();
    if (error) throw new Error(`plan ${label}: ${error.message}`);
    return data.id as string;
  };

  // This month, still running. Held until it ends, whatever happens.
  const pA = await plan(sA, 'running', { current_period_end: iso(days(12)) });
  await makeEarning({
    payee_id: counselor, kind: 'counselling_month', plan_id: pA,
    period_start: dateOf(-days(18)), period_end: iso(days(12)),
    amount_cents: tierShare, status: 'pending', releasable_at: iso(days(15)),
    source_charge_id: await realCharge(tierPrice, 'plan running'),
  });
  console.log(`\n  plan running        ${usd(tierShare)} held until the month ends`);

  // Ended, and the counsellor worked. Payable.
  const pB = await plan(sB, 'delivered', { current_period_end: iso(-days(5)) });
  await db.from('sessions').insert({
    student_id: sB, tutor_id: counselor, subject: `${TAG} advising`,
    date: dateOf(-days(20)), start_time: '10:00', duration_minutes: 60,
    status: 'completed', kind: 'advising', completed_at: iso(-days(20)),
  });
  await makeEarning({
    payee_id: counselor, kind: 'counselling_month', plan_id: pB,
    period_start: dateOf(-days(35)), period_end: iso(-days(5)),
    amount_cents: tierShare, status: 'pending', releasable_at: iso(-days(2)),
    source_charge_id: await realCharge(tierPrice, 'plan delivered'),
  });
  console.log(`  plan delivered      ${usd(tierShare)} payable, an advising hour happened`);

  // Ended, and nothing happened. Refused, and an admin is told.
  const pC = await plan(sC, 'idle', { current_period_end: iso(-days(5)) });
  await makeEarning({
    payee_id: counselor, kind: 'counselling_month', plan_id: pC,
    period_start: dateOf(-days(35)), period_end: iso(-days(5)),
    amount_cents: tierShare, status: 'pending', releasable_at: iso(-days(2)),
    source_charge_id: await realCharge(tierPrice, 'plan idle'),
  });
  console.log(`  plan idle           ${usd(tierShare)} refused, nothing was delivered`);

  // ---- last year, for the tax screen ----
  const lastYear = new Date().getFullYear() - 1;
  const endOfLastYear = new Date(`${lastYear}-06-15T12:00:00Z`).toISOString();
  await makeEarning({
    payee_id: counselor, kind: 'counselling_month', plan_id: pB,
    period_start: `${lastYear}-06-01`, period_end: `${lastYear}-07-01T00:00:00Z`,
    amount_cents: 62_000, status: 'settled',
    method: 'zelle', reference: 'ZELLE-SCENARIO-9', settled_at: endOfLastYear,
  });
  console.log(`\n  last year           ${usd(62_000)} to the counsellor, paid by Zelle`);

  console.log(`\nDone. npm run scenarios status to see it, clear to remove it.\n`);
}

// ------------------------------------------------------------
// fast-forward and release
// ------------------------------------------------------------

async function runJob(): Promise<any> {
  process.env.JOBS_TOKEN = process.env.JOBS_TOKEN || 'scenario-token';
  const handler = (await import('../api/_handlers/run-jobs.js')).default;
  const out: any = {};
  const res: any = {
    status(code: number) { out.code = code; return res; },
    json(body: any) { out.body = body; return out; },
    end() { return out; },
  };
  await handler(
    { method: 'POST', headers: { 'x-jobs-token': process.env.JOBS_TOKEN }, body: {} } as any,
    res
  );
  return out.body ?? {};
}

/**
 * Make everything booked have already happened.
 *
 * The answer to "I cannot book at 1 AM". Book at whatever hour the tutor
 * offers, on whatever future date, then run this: every upcoming lesson moves
 * to yesterday and the job completes it and writes what is owed. What you
 * booked through the UI becomes a real earning without waiting for the day.
 */
async function fastForward() {
  const { data: upcoming } = await db
    .from('sessions')
    .select('id, subject, date')
    .eq('status', 'upcoming');

  const rows = upcoming ?? [];
  if (rows.length === 0) {
    console.log('\nNothing upcoming to move.\n');
  } else {
    // Yesterday, so it is finished under any timezone reading.
    const when = dateOf(-days(1));
    for (const s of rows) {
      await db.from('sessions').update({ date: when }).eq('id', s.id);
    }
    console.log(`\nMoved ${rows.length} upcoming ${rows.length === 1 ? 'lesson' : 'lessons'} to ${when}.`);
  }

  const result = await runJob();
  console.log(
    `Job: completed ${result.sessions?.completed ?? 0}, ` +
      `no-shows ${result.sessions?.noShows ?? 0}, ` +
      `earnings written ${result.sessions?.earningsWritten ?? 0}.`
  );
  if (result.errors?.length) console.log(`Errors: ${result.errors.join(' | ')}`);
  console.log('\nThose earnings are now held. npm run scenarios release to pay them.\n');
}

/** Expire every hold, then let the job pay whatever is genuinely payable. */
async function release() {
  const { data: held } = await db
    .from('earnings')
    .select('id')
    .eq('status', 'pending')
    .gt('releasable_at', new Date().toISOString());

  for (const e of held ?? []) {
    await db.from('earnings').update({ releasable_at: iso(-hours(1)) }).eq('id', e.id);
  }
  console.log(`\nExpired ${(held ?? []).length} hold(s).`);

  const result = await runJob();
  console.log(
    `Job: transferred ${result.payouts?.transferred ?? 0} ` +
      `(${usd(result.payouts?.amountCents ?? 0)}), skipped ${result.payouts?.skipped ?? 0}.`
  );
  if (result.errors?.length) console.log(`Errors: ${result.errors.join(' | ')}`);
  console.log(
    '\nSkipped is the honest answer for a payee with no connected bank, and for a\n' +
      'counselling month where nothing was delivered.\n'
  );
}

// ------------------------------------------------------------
// status and clear
// ------------------------------------------------------------

async function status() {
  const { data: earnings } = await db
    .from('earnings')
    .select('amount_cents, status, method, releasable_at, kind, payee:profiles!earnings_payee_id_fkey (full_name)')
    .is('voided_at', null);

  const rows = earnings ?? [];
  const now = Date.now();
  const sum = (test: (r: any) => boolean) =>
    rows.filter(test).reduce((n, r) => n + r.amount_cents, 0);

  console.log('\nEarnings ledger\n');
  console.log(`  held (hold running)   ${usd(sum((r) => r.status === 'pending' && new Date(r.releasable_at).getTime() > now))}`);
  console.log(`  owed (hold expired)   ${usd(sum((r) => r.status === 'pending' && new Date(r.releasable_at).getTime() <= now))}`);
  console.log(`  settled through Stripe ${usd(sum((r) => r.status === 'settled' && r.method === 'stripe_connect'))}`);
  console.log(`  settled another way    ${usd(sum((r) => r.status === 'settled' && r.method !== 'stripe_connect'))}`);
  console.log(`  cancelled             ${usd(sum((r) => r.status === 'cancelled'))}`);

  const { data: sessions } = await db.from('sessions').select('status');
  const byStatus = (sessions ?? []).reduce((acc: Record<string, number>, s: any) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nSessions   ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);

  const { data: invoices } = await db.from('invoices').select('status, amount_cents');
  const invByStatus = (invoices ?? []).reduce((acc: Record<string, number>, i: any) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Invoices   ${Object.entries(invByStatus).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);

  const { data: refunds } = await db.from('refunds').select('amount_cents, reason');
  console.log(`Refunds    ${(refunds ?? []).length}, ${usd((refunds ?? []).reduce((n, r: any) => n + r.amount_cents, 0))}`);
  console.log('');
}

async function clear() {
  // Earnings first: they point at the sessions and plans below.
  const { data: taggedSessions } = await db.from('sessions').select('id').like('subject', `${TAG}%`);
  const sessionIds = (taggedSessions ?? []).map((s: any) => s.id);

  const { data: taggedPlans } = await db
    .from('admissions_plans').select('id').like('stripe_subscription_id', 'sub_scenario_%');
  const planIds = (taggedPlans ?? []).map((p: any) => p.id);

  const { data: taggedInvoices } = await db.from('invoices').select('id').like('description', `${TAG}%`);
  const invoiceIds = (taggedInvoices ?? []).map((i: any) => i.id);

  await db.from('earnings').delete().like('note', `${TAG}%`);
  if (sessionIds.length) await db.from('earnings').delete().in('session_id', sessionIds);
  if (planIds.length) await db.from('earnings').delete().in('plan_id', planIds);
  if (invoiceIds.length) await db.from('refunds').delete().in('invoice_id', invoiceIds);
  if (sessionIds.length) await db.from('sessions').delete().in('id', sessionIds);
  if (planIds.length) await db.from('admissions_plans').delete().in('id', planIds);
  if (invoiceIds.length) await db.from('invoices').delete().in('id', invoiceIds);

  console.log(
    `\nRemoved ${invoiceIds.length} invoice(s), ${sessionIds.length} session(s), ` +
      `${planIds.length} plan(s) and everything hanging off them.\n`
  );
}

// ------------------------------------------------------------

const command = process.argv[2];
const commands: Record<string, () => Promise<void>> = {
  build, 'fast-forward': fastForward, release, status, clear,
};

if (!command || !commands[command]) {
  console.log(`
Money states for testing, against the local stack only.

  npm run scenarios build         every state at once
  npm run scenarios fast-forward  make booked lessons have happened, and run the job
  npm run scenarios release       expire every hold, and pay what is payable
  npm run scenarios status        what exists now
  npm run scenarios clear         remove everything this made

Typical run:

  npm run db:reset
  npm run scenarios build
  npm run scenarios status
  ... look at /tutor/earnings, /admin/billing, /parent/billing ...
  npm run scenarios release
`);
  process.exit(command ? 1 : 0);
}

commands[command]().catch((err) => {
  console.error(`\n${err?.message ?? err}\n`);
  process.exit(1);
});
