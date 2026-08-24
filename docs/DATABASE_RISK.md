# CRITICAL: the database has no backups

**Status: unresolved. This is the largest single risk to the company.**

Read this before the Stripe work. Losing the database loses the business;
losing a Stripe integration loses a week.

---

## What is actually true, checked against Supabase's own pricing page

| | Free | Pro ($25/mo) |
| --- | --- | --- |
| Backup retention | **Not included** | 7 days |
| Paused after inactivity | **1 week** | never |
| Point-in-time recovery | add-on only | add-on |

**The Free plan takes no backups at all.** Not daily, not weekly. There is no
snapshot anywhere. If a migration corrupts a table, or somebody runs a DELETE
without a WHERE, or the project is deleted, **the data is gone**.

An earlier note in this repo said the free tier had daily backups. That was
wrong, and it is the assumption worth correcting hardest, because it made the
risk look survivable when it is not.

### What pausing does and does not do

Pausing is **not** data loss. After a week with no API calls, no database
connections and no dashboard logins, the project freezes. The Postgres volume,
Storage buckets and function config stay on disk and come back when restored
from the dashboard.

It becomes data loss on a long enough timeline: a project paused for more than a
year can no longer be restored from Studio.

For Yakal today this is largely theoretical — a live site with real users makes
API calls daily. It becomes real the moment the site is quiet for a week, which
is exactly the situation where nobody is watching.

## What to do, in order

**1. Move production to Pro, $25/month.** This buys 7 day backup retention and
removes pausing. It is the cheapest insurance the company will ever buy and the
only item here that cannot be done with code.

**2. Take a backup now, before anything else.** Even on Pro, "backups exist" and
"a restore works" are different claims, and only one of them has been tested:

```
docker exec -i supabase_db_yakal pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges -Fc -f yakal-$(date +%F).dump
```

The container's `pg_dump` is used because production runs Postgres 17 and the
system one is 16, which refuses on version mismatch.

**3. Restore it somewhere and confirm it works.** A backup nobody has restored
is a belief, not a backup. Restore into the local stack and check that
`profiles`, `invoices`, `earnings` and `sessions` all come back with their row
counts intact.

**4. Automate it.** A GitHub Action on a schedule, dumping to a private
repository or object storage. Roughly an hour, and it survives Supabase itself
going wrong, which Pro's own backups do not.

## Should we move off Supabase?

Not for this reason. **Neon's free tier has the same shape of problem** — it
scales to zero and its history retention is short — and moving would mean
rewriting auth, RLS, storage and realtime, which is months of work to solve a
problem $25/month solves today.

Revisit if the bill grows or if Postgres branching becomes worth it. It is not
an answer to "we have no backups".

## Hard delete or soft delete?

**Storage is not the reason.** Production is **15 MB** against a 500 MB free
limit. Deleting users to save space would be optimising the one resource that is
not scarce.

The real question is legal, and the answer is both:

- **Soft delete stays the default.** It is reversible, and "the admin deleted
  the wrong person" is a far more likely event than an erasure request.
- **A real hard-delete path is needed for erasure requests.** Keeping a child's
  data after being asked to remove it is the problem, and the current behaviour
  bans rather than deletes.

**Financial records are the exception.** Invoices, refunds and earnings have to
survive an erasure request for tax and 1099 purposes. The correct shape is to
anonymise the person and keep the money: null the name, email and phone on
`profiles`, keep the rows that reference them. `earnings.payee_id` and
`invoices.parent_id` should survive; who that id belonged to should not.

Related: `notes/TODO.md` already carries "deleted user shouldnt be banned (but
hard delete)" and "user is banned issue".

## What a full review still has to cover

This document is the alarm, not the investigation. Left to do:

- Confirm which plan production is actually on (Dashboard > Project Settings >
  Billing). Everything above assumes Free; verify rather than assume.
- Whether the anon key's RLS holds against a determined reader, table by table.
  One hole was already found in `blog_posts` and the notes still flag "any
  signed-in user can read every profile".
- Storage buckets: `avatars`, `resumes` and `testimonials` are not in any dump
  taken with `pg_dump`, which covers the database only.
- Retention: how long messages between children and adults are kept, and whether
  that is a decision anybody has made.
- Whether Supabase's free-tier terms have changed again by the time this is
  read. They have changed before, and every figure above should be re-checked
  rather than trusted from this file.

---

*Written 20 August 2026, after a production migration converted live tier
prices with no backup in place to undo it. Nothing was lost. Nothing would have
been recoverable if it had been.*
