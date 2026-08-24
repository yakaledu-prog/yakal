# Payments setup: the things not in code

Some switches have to be thrown by hand, in Stripe and in Supabase. None of them
is a secret you need to send anybody: they are set in a dashboard, and nothing
here asks you to share a key.

The first two are blocking. Without the Connect webhook, **nobody who connects a
bank is ever paid automatically**. Without the scheduled job, **nothing is ever
marked complete and no money ever moves**. Both fail silently, which is why they
are written down rather than left to be noticed.

Parts 3 and 4 are not blocking today. Part 3 is a convenience with a running
cost, and part 4 has a January deadline that is easier to meet early than late.

---

## Part 1: the Connect webhook endpoint

### Why this exists

Stripe splits its events into two piles, and this is the part that surprises
people.

| | What it covers | Where it goes |
| --- | --- | --- |
| **Account events** | payments, refunds, subscriptions, disputes. Things that happen to *your* Stripe account. | the endpoint you already have |
| **Connect events** | things that happen to a *connected* account, which is every tutor and counsellor who has attached a bank. | **nowhere, until you make a second endpoint** |

The one that matters is `account.updated`. When a tutor finishes Stripe's
onboarding and Stripe decides it can pay them, `account.updated` is the **only**
notification that happens. Nothing else tells us.

If it never arrives, `stripe_payouts_enabled` stays false on their profile, the
scheduled job skips them every single run as "no connected account", and they
are never paid. Nothing errors. The tutor sees "Awaiting your bank" forever on a
bank they already connected.

A Connect endpoint is a **separate endpoint with its own signing secret**, even
if it points at the same URL. The code now accepts either secret, so you only
have to create the endpoint and paste one value.

### What to do

**Run the script.** It creates the endpoint with the right flag and the right
events, and prints the secret:

```
npx tsx scripts/setup-connect-webhook.ts
```

Then paste what it prints into Render > your service > **Environment**:

```
STRIPE_CONNECT_WEBHOOK_SECRET = whsec_...
```

Render restarts on its own. Running the script twice is safe: it finds the
existing endpoint rather than making a second one. The signing secret is only
readable at creation, so if the value is lost, delete the endpoint in Stripe and
run it again.

When you move to live keys, run it once more with the live `STRIPE_SECRET_KEY`.
Test and live endpoints are separate, and so are their secrets.

### Doing it by hand instead

The dashboard route, if you would rather see it:

**Stage 1.** Stripe Dashboard > **Developers** > **Webhooks** > **Add endpoint**.

**Stage 2.** Endpoint URL. The same one your existing webhook uses:

```
https://yakal.me/api/stripe-webhook
```

**Stage 3.** This is the step that makes it a Connect endpoint and the one
everybody misses. Look for **"Listen to events on Connected accounts"** and turn
it on. In the newer dashboard it is a radio choice near the top: **Your account**
or **Connected accounts**. Pick **Connected accounts**.

If you skip this you have simply made a second ordinary endpoint, and
`account.updated` still never arrives.

**Stage 4.** Select events. Add these two:

```
account.updated
payout.failed
```

`account.updated` is the load-bearing one. `payout.failed` is so a payout
bouncing off a closed bank account is visible rather than money that quietly
never landed.

**Stage 5.** Click **Add endpoint**. Stripe shows a **Signing secret** starting
`whsec_`. Click reveal and copy it.

**Stage 6.** Render Dashboard > your service > **Environment** > **Add
environment variable**:

```
STRIPE_CONNECT_WEBHOOK_SECRET = whsec_...
```

Save. Render restarts the service on its own.

### Checking it worked

Stripe Dashboard > Developers > Webhooks > click the new endpoint. After a
tutor next completes onboarding you should see an `account.updated` delivery
with a **200**. A 400 there means the secret does not match what Render holds.

You can also force one: open the endpoint, **Send test event**, choose
`account.updated`. A 200 is the whole test.

---

## Part 2: the scheduled job

### Why this exists

A web app only runs when somebody loads a page. Two things here have to happen
whether or not anybody is looking:

- a lesson whose time has passed has to be **marked complete**, so the tutor
  earns from it
- an earning whose 72 hour hold has expired has to be **transferred**

Nobody is at a keyboard for either. So something outside has to call us on a
schedule. That caller is not a signed-in person, so it cannot authenticate the
way a person does; it uses a shared token instead.

**Supabase Cron** does the calling. It is free, it is already in your stack, and
it can make HTTP requests directly, so there is no new service to pay for or
watch.

The token is `JOBS_TOKEN`. **With no token set, the job refuses everybody** —
including Stripe, including you. That is deliberate: an endpoint that moves
money must not fail open. The cost of forgetting it is that nobody gets paid,
which is recoverable. The cost of failing open is that anybody who guesses the
URL can trigger payouts.

### What to do

**Stage 1.** Pick a token. Any long random string. On your machine:

```
openssl rand -hex 16
```

Your local `.env` already has one; production should have a **different** one,
so a leak of one environment does not reach the other.

**Stage 2.** Render Dashboard > your service > **Environment**:

```
JOBS_TOKEN = <the string from stage 1>
```

Save, and let it restart.

**Stage 3.** Run the script. It reads `JOBS_TOKEN` from your environment rather
than having you paste it into SQL, and reads the job back afterwards to confirm
it is really there:

```
APP_BASE_URL=https://yakal.me npx tsx scripts/setup-cron.ts --confirm
```

Without `--confirm` it prints what it would do and changes nothing. It refuses
outright if `APP_BASE_URL` is localhost while the project is hosted, because
that combination schedules a job that fires hourly and reaches nothing.

Run it again after rotating `JOBS_TOKEN`: it replaces the schedule rather than
leaving a second one behind that now returns 401 every hour.

### Doing it by hand instead

Supabase Dashboard > your **production** project > **SQL Editor** > New query.
Paste this, replacing YOUR-JOBS-TOKEN with the value from stage 1, and Run:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'yakal-payout-jobs',
  '0 * * * *',
  $$
    select net.http_post(
      url     := 'https://yakal.me/api/connect?action=run-jobs',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-jobs-token', 'YOUR-JOBS-TOKEN'
                 ),
      body    := '{}'::jsonb
    );
  $$
);
```

`'0 * * * *'` is the top of every hour. Hourly rather than daily so a lesson
finishing at 9am is not left until midnight, and so a run that fails retries
within the hour instead of the next day.

This is not a migration on purpose. It contains that environment's URL and that
environment's token, and migrations are committed to the repository.

### Checking it worked

In the same SQL editor, after the next hour turns:

```sql
select status, return_message, start_time
  from cron.job_run_details
 where jobname = 'yakal-payout-jobs'
 order by start_time desc
 limit 5;
```

`succeeded` is what you want. If it says the request returned **401**, the token
in the SQL and the token in Render do not match.

To test without waiting an hour, run the `select net.http_post(...)` part on its
own.

### Changing it later

```sql
select cron.unschedule('yakal-payout-jobs');
```

then schedule it again. Rotating `JOBS_TOKEN` means changing it in **both**
places, Render and this statement, and the job is refused in between.

---

## Part 3: instant payouts

### Why this exists

Payouts to a payee's bank now run **weekly, on a Friday**. The code sets that
when it creates their account, so there is nothing to configure for the ordinary
case.

Instant payouts are the exception: a tutor who does not want to wait until Friday
can take the money in about thirty minutes. They do it themselves from their
Stripe Express dashboard, which the app now links to from the earnings page, so
there is no screen here to build. What cannot be done from code is enabling it
and deciding who pays for it.

**Stripe charges the platform 1% of every instant payout, minimum $0.50.** Left
alone, that comes out of Yakal. An application fee moves it to the tutor who
chose the convenience, which is the intended arrangement.

### What to do

1. In the Stripe dashboard, go to **Settings > Connect > Payouts** and turn on
   instant payouts for connected accounts.
2. Under **External accounts**, set **Allow debit cards** to **Yes**. Most
   instant payouts in the US go to a debit card, and without this a tutor has no
   eligible destination.
3. Open the **Platform pricing** tool for instant payouts and set the fee to
   cover Stripe's 1% with a $0.50 minimum.

### If you would rather not

Skip it. Nothing breaks: tutors are paid weekly, the dashboard link still shows
them their balance and history, and the option simply is not offered.

---

## Part 4: 1099 tax forms

### Why this exists

This one is worth reading carefully, because it is the opposite of what is
usually assumed about Express accounts.

Express means Stripe collects the bank details, the SSN and the identity
documents on its own pages, so none of it touches our servers. That liability is
genuinely gone. **The tax filing obligation is not.** Stripe issues a 1099-K only
when the connected account pays the processing fees; ours are set to
`application_express`, meaning Yakal pays them. So **Yakal is the filer**, and
owes a **1099-NEC** to every tutor or counsellor paid $600 or more in a calendar
year.

Stripe will do the mechanics through its 1099 product: it generates the forms,
collects the missing tax details from the payee, e-files with the IRS, and
delivers a copy into the Express dashboard the payee already has. The obligation
stays ours; the paperwork does not have to be.

### What to do, before January

1. In the Stripe dashboard open **Connect > Tax reporting** and press **Get
   started**. Choose **1099-NEC**, and answer the filer questions.
2. Turn on **e-delivery** and **outreach from Stripe** in the tax form settings,
   so Stripe chases payees for missing tax details rather than you.
3. Add state registration numbers for any state you file in.
4. **Reconcile against our own ledger before filing.** Stripe only knows what
   moved through Stripe, and `connect-transfer.ts` deliberately supports paying
   somebody by ACH, Zelle or cheque with a reference, because a tutor who never
   finishes onboarding still has to be paid. Those dollars are reportable too,
   and a form built from Stripe's view alone understates them.

   This is expected rather than awkward: Stripe's tax dashboard lets you **edit a
   form's total** to include payments made outside Stripe, which is exactly this
   case. Our ledger is the complete figure, so where the two disagree, ours wins
   and Stripe's form gets corrected to match.

   **The admin billing page does this for you.** `/admin/billing` has a **Tax
   forms** section: pick the year and it lists everybody paid, flags who is over
   the $600 threshold, and shows how much of each person's total was paid
   outside Stripe. That last figure is what to correct Stripe's draft form to.
   Nobody needs to run a query.

### Key dates

Stripe begins contacting payees in early November. Forms can be e-filed from
mid-January, and the IRS deadline for getting them to recipients is **31
January**.

---

## What is needed from you, in one list

**Blocking, do these first:**

1. Run `npx tsx scripts/setup-connect-webhook.ts` and put the
   `STRIPE_CONNECT_WEBHOOK_SECRET` it prints into Render.
2. Set `JOBS_TOKEN` in Render, and in your local `.env` so the script can read it.
3. Run `APP_BASE_URL=https://yakal.me npx tsx scripts/setup-cron.ts --confirm`.

**When you want it:**

4. Enable instant payouts and set the application fee (part 3).

**Before January:**

5. Set up Stripe's 1099 tax reporting, and reconcile it against
   `earnings_year_totals` (part 4).

None of these need a secret sent anywhere, and none of them need anything from
me. All of it is dashboard work, and the site answers at `https://yakal.me`.
