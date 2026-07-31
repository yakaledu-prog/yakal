# Database

Development runs against a full Supabase stack in Docker on your machine, not
the hosted project. Schema changes, wipes and reseeds cost seconds and touch
nothing shared.

`supabase/migrations` is the source of truth for the schema, and
`scripts/seed/data.ts` for the demo data. Both the local stack and the hosted
project are built from those two, which is what keeps them behaving alike.

## Why not a JSON mock server

It was considered and rejected. Every service in `src/services` calls
`supabase-js`, which speaks PostgREST: `?user_id=eq.<uuid>`,
`select=id,participants:conversation_participants(user_id)`, `Range` headers.
A JSON mock speaks a different dialect, so adopting one means rewriting every
service against a second API and maintaining both.

More importantly it would not represent the real flow:

- no auth, so the signup and login screens could not be demoed at all
- no row level security, and RLS is where the messaging bug fixed in
  `20260731000100_fix_messaging_rls_recursion.sql` actually lived. A mock would
  have hidden that bug rather than caught it
- no realtime, so presence, typing indicators and live message delivery would
  all need separate stubs

The local stack is the same software as production, so none of that applies.

## Setup

Requires Docker.

```
npm install
npm run db:start     # first run pulls ~2GB of images
npm run db:seed
npm run dev
```

Useful URLs once it is up:

| What | Where |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio (table editor, SQL console) | http://localhost:54323 |
| Mailpit (every email the app sends) | http://localhost:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run db:start` | Bring the stack up, applying any migrations |
| `npm run db:stop` | Shut it down |
| `npm run db:reset` | Drop everything, replay all migrations, reseed. The one to reach for after a breaking schema change |
| `npm run db:seed` | Load the demo dataset. Safe to re-run |
| `npm run db:seed:fresh` | Clear the dataset's rows first, then reload |
| `npm run db:new <name>` | Create an empty migration file |
| `npm run db:diff <name>` | Capture changes you made in Studio as a migration |
| `npm run db:status` | Container health and URLs |

## Switching backends

`VITE_BACKEND` in `.env`:

```
VITE_BACKEND=local     # Docker stack on this machine (default in dev)
VITE_BACKEND=remote    # the hosted project
```

Both credential sets live in `.env` at once, so this is a one word change.
Restart `npm run dev` after editing it. The browser console prints which
backend is live on every boot, teal for local and amber for remote.

Unset, it resolves to local in dev and remote in a production build, so Vercel
deploys are unaffected.

## Demo accounts

All seeded with the password `demo123` and a pre-confirmed email, matching the
one-click logins on the sign-in page.

| Email | Role |
| --- | --- |
| `admin@yakal.com` | admin (Almaz Tadesse) |
| `tutor@yakal.com` | tutor (Bethlehem Alemu) |
| `counselor@yakal.com` | counselor (Daniel Haile) |
| `student@yakal.com` | student (Amen Worku) |
| `parent@yakal.com` | parent (Tigist Worku, linked to Amen) |

Signing up by hand works too. Confirmation is disabled locally so you land
straight in the app, and anything the app does send is captured by Mailpit.
Because `npm run db:reset` clears `auth.users` as well, an address you already
used stops being "occupied", so there is no manual cleanup in the dashboard.

## Adding demo data

Edit `scripts/seed/data.ts`. It holds the accounts, parent links, tutor
availability, courses, conversations and blog posts as plain arrays, and
`npm run db:seed` applies them.

Nothing in that file uses a hardcoded UUID. Rows refer to people by email and
the seeder resolves those to real ids at run time, so the same dataset applies
to a database that has never been seeded before, local or hosted.

The seeder converges rather than duplicating: accounts are matched by email and
updated, courses and posts by title, conversations by the pair of people in
them. Messages are only written into a conversation that has none, so an
exchange you had while testing is never overwritten. Use `db:seed:fresh` to
start the dataset over.

## Changing the schema

1. `npm run db:new <name>`, or make the change in Studio and capture it with
   `npm run db:diff <name>`
2. `npm run db:reset` to confirm it replays cleanly from nothing
3. Commit the file in `supabase/migrations`

Migrations run in filename order, so the timestamp prefix matters. Write them
so they can run twice without error (`if not exists`, `drop ... if exists`
before `create`); the deploy job is not the place to discover otherwise.

## Deploying to the hosted project

`.github/workflows/database.yml` handles it.

- **On a push to `main`** touching `supabase/**` or the seed: the workflow
  builds the database from nothing on a clean runner, seeds it, checks the
  result, and only then applies the pending migrations to the hosted project.
  It never seeds the hosted project on a push.
- **Manually** (Actions tab, "Database", Run workflow) you additionally get
  `seed_demo_data` and `fresh_seed`.

Seeding online is opt-in because it writes accounts whose password is written
down in this repository. Keep it for a testing project.

### Repository secrets

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | `postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key, server side only |

Use the pooler host, not `db.<ref>.supabase.co`. The direct host resolves to
IPv6 only, which neither GitHub runners nor WSL2 can reach. For this project
the pooler is `aws-1-eu-central-2.pooler.supabase.com`.

### First run against the existing project

The hosted project was built by hand before this migration history existed, so
its tables are already there while its migration ledger is empty. Replaying the
baseline over it would fail on the first constraint that already exists.

So the **first** deploy has to be a manual run with **`adopt_existing_schema`
ticked**. That records the baseline as applied without executing it, and the
push then starts from the migrations that follow. Leave the box unticked
forever after.

The same thing by hand:

```
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres'
npm run db:push:remote
```

## How this repo got its baseline

There was no migration history before this; the schema lived only in the hosted
database, and the old `docs/db_schema.sql` had drifted well away from it (it
still described `conversations.participant_1/participant_2` and `messages.text`
while the real table uses a `conversation_participants` join table and
`messages.content`). That file and the loose `db/**` scripts are gone; the
migrations replace them.

`20260731000000_baseline_remote_schema.sql` is a `supabase db dump` of the live
database, so it records reality as of 2026-07-31, drift and all.

Two things that dump could not capture, because it only covers the `public`
schema, are restored by the migrations right after it: the
`auth.users` -> `handle_new_user` trigger, and the `avatars` storage bucket with
its policies.
