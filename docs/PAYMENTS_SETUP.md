# Payments setup: the two things not in code

Two switches have to be thrown by hand, one in Stripe and one in Supabase.
Neither is a secret you need to send anybody: both are set in a dashboard, and
nothing here asks you to share a key.

Without the first, **nobody who connects a bank is ever paid automatically**.
Without the second, **nothing is ever marked complete and no money ever moves**.
Both fail silently, which is why they are written down rather than left to be
noticed.

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

**Stage 3.** Supabase Dashboard > your **production** project > **SQL Editor** >
New query. Paste this, replacing YOUR-JOBS-TOKEN with the value from stage 1,
and Run:

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

## What is needed from you, in one list

1. Create the Connect webhook endpoint, and set `STRIPE_CONNECT_WEBHOOK_SECRET`
   in Render.
2. Set `JOBS_TOKEN` in Render.
3. Run the `cron.schedule` statement in the production Supabase SQL editor,
   with your `JOBS_TOKEN` substituted in.

None of these need a secret sent anywhere, and none of them need anything from
me. All three are dashboard work, and the site answers at `https://yakal.me`.
