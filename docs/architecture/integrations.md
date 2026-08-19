# The outside world

Five external services and one scheduled job. Each has an operational guide in
`docs/`; this is what the code does with them and where the seams are.

---

## Supabase

Database, auth, storage and realtime. The browser talks to it directly with the
`anon` key; `api/` talks to it with the service-role key when it needs to
bypass RLS.

`api/_utils/supabase.ts` picks which project to talk to. The rule matches the
frontend: an explicit `BACKEND` flag wins, otherwise production means the
hosted project and anything else means the local Docker stack. This exists
because the API used to always use the hosted project, so in development it
handed a token issued by the local stack to the hosted project's auth, which
rightly rejected it, and every billing call came back 401.

**Storage buckets**: `avatars` (upload scoped to your own id), `resumes`,
`testimonials` (admin-only write). A new bucket needs its policies in a
migration, in `storage.objects`.

**Realtime publication**: `messages`, `notifications`, `conversations`,
`conversation_participants`. A table not in that publication produces a silent
subscription, not an error.

## Stripe

Hosted Checkout, so **no publishable key and nothing Stripe-related in the
browser bundle**. The server creates a session, the browser is redirected to
Stripe and back.

Separate charges and transfers: Yakal is merchant of record, takes the whole
payment, and moves each person's share to their connected account afterwards.

**The rule everything else follows: money is never transferred to a payee
before the work is delivered.** Stripe does not reverse a transfer when the
charge that funded it is refunded, and funds that have reached a connected
account's bank cannot be recovered at all. So an earning is written when a
lesson completes, not when a parent pays, and it waits out a 72 hour hold
before it moves. Undelivered money stays in the platform balance, where
refunding it costs one call and reverses nothing.

`api/_utils/earnings.ts` is that ledger. One row per amount owed to one person,
carrying both the obligation and how it was settled. It replaced
`invoices.payout_cents`, `sessions.payout_cents`, `tutor_payouts` and
`counselor_payouts`, which were four mechanisms for one question.

**Transfers and payouts are different things and only one of them costs.** A
transfer moves money from the platform balance to a connected account and is
free and instant. A payout moves it from there to their bank, costs
0.25% + $0.25, and runs on a schedule Stripe operates itself. So transfers
happen per delivered session, and **nothing here schedules a payout**.

Instant Payouts are deliberately not built: Stripe bills the platform 1%, not
the payee, so passing that on is work nobody has asked for.

`stripe-webhook.ts` is a separate function because Stripe signs the raw body and
any framework that parses it first breaks verification.

| Event | What it does |
| --- | --- |
| `checkout.session.completed` | marks the invoice paid, resolves and stores the charge id, fulfils |
| `checkout.session.async_payment_succeeded` | the same, for delayed methods |
| `invoice.paid` / `invoice.payment_failed` | counselling instalments |
| `charge.refunded` / `charge.dispute.created` | cancels every **pending** earning that charge funded |
| `transfer.reversed` | a reversal begun in the Stripe dashboard |
| `account.updated` | a payee finishing, or failing, onboarding |

**The webhook is the only thing that grants access.** The redirect back from
Stripe unlocks nothing, deliberately: a customer who closes the tab has still
paid.

`account.updated` is about **connected** accounts, so it needs a second endpoint
scoped to Connected accounts with its own signing secret. The handler currently
reads one `STRIPE_WEBHOOK_SECRET`, so that has to be resolved before payouts
work. `transfer.reversed` is not affected: transfers are platform objects and
arrive on the account endpoint.

**Everyone is assumed to be in the US.** Stripe Connect only pays connected
accounts in the US, UK, EEA, Canada and Switzerland, so `connect-onboard.ts`
creates US accounts. Payees elsewhere need a different rail entirely, and that
is out of scope until after launch.

## The scheduled job

`POST /api/connect?action=run-jobs`, called by Supabase Cron. It does two
things, both idempotent: complete lessons whose slot has passed, and transfer
earnings whose hold has expired.

Authentication is `JOBS_TOKEN` as an `x-jobs-token` header, because the caller
is a cron job with no user to be. **With no token configured it refuses
everyone rather than allowing everyone**, so a deployment that forgets it pays
nobody rather than paying anybody who asks.

Completion is automatic. A tutor marking their own session complete is a tutor
authorising their own payment, and a parent confirming every lesson is a queue
that stalls the moment somebody stops replying. What makes automatic safe is
the hold, not the marking: a lesson that did not happen has three days to be
disputed while the money is still ours.

Whether a lesson has ended is answered by `sessions_due_for_completion` in
Postgres rather than in Node, because sessions store a naive date and time and
the answer depends on a timezone. Parsing `'2026-08-19T14:00'` in Node uses
whatever zone the process runs in, which on Render is UTC and on a laptop is
not, so the same row would be judged differently in the two places.

**Setting the schedule up** is one statement per environment, run once. It is
not a migration because it embeds that environment's URL and token:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('yakal-payout-jobs', '0 * * * *', $$
  select net.http_post(
    url     := 'https://your-app.onrender.com/api/connect?action=run-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-jobs-token', 'the JOBS_TOKEN value'),
    body    := '{}'::jsonb
  );
$$);
```

Hourly rather than daily so a lesson finishing at 9am is not marked complete at
midnight, and so a failed run retries within the hour instead of the day.

## Google

Two independent paths that fail differently, which is why Google problems look
chronic:

| | Server side | Browser side |
| --- | --- | --- |
| Who | one Yakal account, always | the signed-in admin |
| Credential | `GOOGLE_OAUTH_REFRESH_TOKEN` | a token from a sign-in popup |
| Used by | Drive documents, reading Classwork | the admin's Fetch Details button |

**Students and tutors never sign in to Google.** They read Classwork through our
server, which checks they are on the course and then asks Google as the one
account. Booking the course is what grants access. The only browser sign-in is
an admin linking a class, because that is the one moment somebody has to pick
from their own classes.

The scopes are `drive.file` plus five Classroom scopes.
`api/_handlers/drive.ts` also declares full `auth/drive`, but only on the
service-account path, which is unused - see the checklist, because that is a
restricted scope with real consequences if it ever goes live.

Wiring an account up from nothing, and what each scope is for, is
`docs/GOOGLE_SETUP.md`.

## Zoom

Server-to-server OAuth creates meetings; a separate meeting SDK credential
signs the client-side join. `api/_utils/zoom.ts` caches the token until it
expires.

## Email

`api/_utils/email.ts` sends through **Resend in production** and **SMTP to
Mailpit otherwise**, decided by `VERCEL_ENV`/`NODE_ENV` plus the presence of a
key. A production key sitting in a local `.env` therefore cannot send real
mail by accident.

Three places send: the contact form, five messages on the Stripe fulfilment
path, and `api/invites.ts`, which mails a child their invitation link. The
invite row is created in the browser under the parent's own session, so RLS has
already decided they may; the endpoint only turns an existing invite into an
email, and reads it through the caller's client so a parent can only mail their
own. If email matters to a feature you are adding, check whether it is actually
wired.

**`EMAIL_PROVIDER` overrides the choice**, and is the only way to reach a real
inbox from a development machine. Without it a production key in a local `.env`
still sends to Mailpit, which is the property worth keeping; naming the provider
is not an accident. Set it back to `smtp`, or remove it, when you are done.

Local sends failing at the socket usually means Mailpit is running with no
published ports: `docker ps` shows `supabase_inbucket_*` with an empty Ports
column, and 54324 and 54325 refuse connections. Restarting the Supabase stack
republishes them.

While Resend is on its shared `onboarding@resend.dev` sender, it will only
deliver to the address the Resend account is registered under. Verify a domain
before expecting mail to reach anybody else.
