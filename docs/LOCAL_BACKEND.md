# Local backend

Development runs against a full Supabase stack in Docker on your machine, not
the hosted project. Schema changes, wipes and reseeds cost seconds and touch
nothing shared.

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
npm run dev
```

`db:start` applies everything in `supabase/migrations` and then `supabase/seed.sql`.

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
| `npm run db:start` | Bring the stack up |
| `npm run db:stop` | Shut it down |
| `npm run db:reset` | Drop everything, replay all migrations, reseed. The one to reach for after a breaking schema change |
| `npm run db:status` | Show container health and URLs |
| `npm run db:diff <name>` | Capture changes you made in Studio as a new migration file |

## Switching backends

`VITE_BACKEND` in `.env`:

```
VITE_BACKEND=local     # Docker stack on this machine (default in dev)
VITE_BACKEND=remote    # the hosted project
```

Both credential sets live in `.env` at once, so this is a one word change.
Restart `npm run dev` after editing it. The browser console prints which
backend is live on every boot - teal for local, amber for remote.

Unset, it resolves to local in dev and remote in a production build, so Vercel
deploys are unaffected.

## Demo accounts

All seeded with the password `demo123` and a pre-confirmed email, matching the
one-click logins on the sign-in page.

| Email | Role |
| --- | --- |
| `admin@yakal.com` | admin |
| `tutor@yakal.com` | tutor (Bethlehem Alemu) |
| `counselor@yakal.com` | counselor |
| `student@yakal.com` | student (Amen Worku) |
| `parent@yakal.com` | parent (Tigist Worku, linked to Amen) |

Signing up by hand works too. Confirmation is disabled locally so you land
straight in the app, and anything the app does send is captured by Mailpit.
Because `npm run db:reset` clears `auth.users` as well, an address you already
used stops being "occupied" - no manual cleanup in the dashboard.

## Changing the schema

1. Write a migration: `supabase migration new <name>`, or make the change in
   Studio and capture it with `npm run db:diff <name>`
2. `npm run db:reset` to confirm it replays cleanly from scratch
3. Commit the file in `supabase/migrations`

Migrations run in filename order, so the timestamp prefix matters.

### Applying to the hosted project

Not automatic, and deliberately so. When a migration is ready to ship:

```
export YAKAL_REMOTE_DB_URL='postgresql://postgres.<ref>:<password>@aws-1-eu-central-2.pooler.supabase.com:5432/postgres'
npm run db:push:remote
```

The pooler host is required. The direct `db.<ref>.supabase.co` host resolves to
IPv6 only, which is unreachable from WSL2.

## How this repo got its baseline

There was no migration history before this; the schema lived only in the hosted
database, and `docs/db_schema.sql` had drifted well away from it (it still
describes `conversations.participant_1/participant_2` and `messages.text`, while
the real table uses a `conversation_participants` join table and
`messages.content`).

`20260731000000_baseline_remote_schema.sql` is a `supabase db dump` of the live
database, so it is the truth as of 2026-07-31, drift and all. Treat
`docs/db_schema.sql` and the loose files in `db/` as historical notes now -
`supabase/migrations` is the source of truth.

Two things that dump could not capture, because it only covers the `public`
schema, are restored by the migrations right after it: the
`auth.users` -> `handle_new_user` trigger, and the `avatars` storage bucket with
its policies.
