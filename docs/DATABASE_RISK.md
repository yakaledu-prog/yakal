# The database backup situation

**Status: solved for free, with two caveats. Read the caveats.**

`.github/workflows/backup.yml` takes an encrypted dump every day and pushes it
to a **separate private repository**. That closes the hole this document was
written about.

---

## The correction

An earlier version of this file said upgrading to Supabase Pro at $25/month was
the only real answer and could not be done with code. **That was wrong**, and it
was the expensive kind of wrong: it presented a recurring cost as mandatory when
a scheduled `pg_dump` does the same job.

What Pro actually buys over the workflow:

| | GitHub Action | Supabase Pro |
| --- | --- | --- |
| Daily backups | yes | yes, 7 day retention |
| Retention | as long as git history | 7 days |
| Survives Supabase itself failing | **yes** | no, they live there |
| Storage buckets | **no** | yes |
| Stops the project pausing | incidentally, see below | yes |
| Cost | nothing | $25/month |

The workflow is better on retention and better on independence. Pro is better on
buckets. Neither is a reason to pay $25 a month today.

## Why a separate repository

**This repository is public.** The first version of the workflow committed the
dumps to a branch here, which would have published encrypted personal data
where anyone could download it and attack it offline for as long as they liked.
AES256 with a long random passphrase is strong, but "children's names, parents'
phone numbers and private messages, publicly downloadable" is not a sentence
worth being one mistake away from.

Nothing leaked: it was caught before the workflow ever ran.

The job now refuses to push to any repository that is not private, checked
through the API on every run. That is not paranoia about today; it is what stops
backups quietly becoming public the day somebody flips that repository open.

## The two caveats

**1. Storage buckets are not covered.** `pg_dump` dumps the database.
`avatars`, `resumes` and `testimonials` live in Supabase Storage and are not in
it. Losing them loses every uploaded CV and profile picture. That is a real gap
and it is not solved yet.

**2. The passphrase is a single point of failure.** The dumps are encrypted
with `BACKUP_PASSPHRASE`, and without it they are noise. Keep it somewhere that
is not this repository and not only in GitHub Secrets.

## The incidental benefit

The free plan pauses a project after a week with no API calls, no database
connections and no dashboard logins. The backup job makes a database connection
every day, so **running it keeps the project awake**. The pausing risk this
document worried about is answered by the same workflow, as a side effect.

## Tested, not assumed

Taken on 3 September 2026 against the local stack:

```
dump            1,512,367 bytes
encrypted         261,713 bytes
restored into a scratch database, 0 errors
profiles 27, sessions 44, invoices 28, earnings 31, plans 8
```

Every count matched the source database, and `auth.users` restored with all 27
rows, so sign-in survives a restore.

At 262 KB a day this is about 95 MB of git history a year, which is nothing.

## Setting it up

1. Create a **private** repository, e.g. `yakaledu-prog/yakal-backups`. Empty
   is fine; the first run initialises it.
2. Generate a passphrase: `openssl rand -base64 48`. Save it in a password
   manager and one other place. Not in a repository.
3. Create a fine-grained PAT with **Contents: read and write** on that
   repository and nothing else.
4. In *this* repository: Settings > Secrets and variables > Actions, add
   `BACKUP_PASSPHRASE`, `BACKUP_REPO` (`owner/name`) and `BACKUP_REPO_TOKEN`.
   `SUPABASE_DB_URL` is already there for the Database workflow.
5. Actions > Backup > Run workflow, to prove it before trusting the schedule.

If the target repository is not private the job stops before dumping anything.

## Restoring

```
git clone git@github.com:yakaledu-prog/yakal-backups.git
BACKUP_PASSPHRASE=... scripts/restore-backup.sh yakal-backups/dump-2026-09-03.sql.gz.gpg
```

With no target it restores into the local stack. It refuses a hosted URL
outright, because a `--clean` dump drops every table it recreates and doing that
to production by mistyping an argument is not a mistake worth leaving available.

**Restore one on purpose, once a quarter.** A backup nobody has restored is a
belief, not a backup.

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

**1. ~~Move production to Pro.~~ Done for free instead.** See the correction at
the top of this file. The workflow covers it, and covers more of it than Pro
would.

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

**4. ~~Automate it.~~ Done.** `.github/workflows/backup.yml`.

**5. Still open: the storage buckets.** Nothing backs up `avatars`, `resumes` or
`testimonials`. A second job listing the buckets through the storage API and
committing the objects would close it.

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
