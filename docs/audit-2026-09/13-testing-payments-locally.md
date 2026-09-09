# How to test payments on this machine

This is written down because the reason payments were hard to test turned out to
be one line of configuration, and it cost an afternoon to notice.

## The problem

`.env` ships with

```
STRIPE_WEBHOOK_SECRET=whsec_...        # from step 5
```

which is a placeholder. `api/stripe-webhook.ts` verifies the signature against
it, so every webhook is rejected. Refunds, `invoice.paid`, subscription upgrades
and cancellations all arrive by webhook, so none of them could ever complete
locally. A payment would go through at Stripe and nothing would happen here.

It is left as a placeholder on purpose, because the value changes every time you
start the listener. This is how to get one.

## The listener

`stripe login` needs an interactive browser and is not required:

```
stripe listen \
  --api-key "$(grep '^STRIPE_SECRET_KEY=' .env | cut -d= -f2-)" \
  --forward-to localhost:3001/api/stripe-webhook
```

It prints a signing secret on the first line. Put that in `.env` as
`STRIPE_WEBHOOK_SECRET`, restart `npm run dev` so the API picks it up, and leave
the listener running. Every event then shows up in its log with the status our
handler returned, which is the fastest way to see whether something landed:

```
--> charge.succeeded [evt_...]
<-- [200] POST http://localhost:3001/api/stripe-webhook [evt_...]
```

Put the placeholder back when you are done, or the next session will fail
signature verification against a secret that no longer exists and look like a
code problem.

## Test cards

| Card | What it does |
| --- | --- |
| 4242 4242 4242 4242 | succeeds |
| 4000 0000 0000 0341 | attaches, then fails when charged |
| 4000 0000 0000 9995 | declined, insufficient funds |
| 4000 0025 0000 3155 | requires 3D Secure |

Any future expiry, any CVC, any postcode.

## Driving the job

The release step is a cron job, not something that happens on its own here:

```
curl -s -X POST "http://localhost:3001/api/connect?action=run-jobs" \
  -H "x-jobs-token: $(grep '^JOBS_TOKEN=' .env | cut -d= -f2-)"
```

Note the header. It reads `x-jobs-token`, not `Authorization: Bearer`.

To watch a full lesson through to a transfer, age the sessions and the hold
rather than waiting three days:

```sql
update sessions set date = current_date - 1 where status = 'upcoming';
update earnings set releasable_at = now() - interval '1 hour' where status = 'pending';
```

Run the job between the two: the first pass completes the lessons and writes
held earnings, the second releases them.

## A trap worth knowing

`profiles.stripe_account_id` cannot be set by hand. A trigger refuses it, for
good reasons written at the top of
`20260822000100_guard_profile_privileged_columns.sql`. The service role is
allowed, which is how the Connect handlers write it, so use the local service
key from `npx supabase status` against PostgREST rather than reaching for
`psql` and disabling the trigger.

## And one about the database

`npx supabase db reset` applies migrations and stops. It does **not** run the
seed, so you end up with an empty database and every check failing on missing
fixtures. Use `npm run db:reset`, which does both.
