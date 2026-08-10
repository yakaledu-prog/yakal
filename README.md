# Yakal

Yakal Education Services: tutoring and college counselling, with a dashboard
for each side of it. Students book sessions and message their tutors, tutors
run courses and assignments, parents follow their children, counselors work
through applications, and admins manage the lot. The public marketing site and
blog live in the same app.

React 18, TypeScript, Vite, Tailwind 4, TanStack Query, and Supabase for
database, auth, storage and realtime.

## Getting started

Requires Docker, for the local database.

```bash
npm install
npm run db:start     # first run pulls ~2GB of images
npm run db:seed
npm run dev
```

Then sign in at `/login` with any demo account, for example
`student@yakal.com` and `demo123`.

Development talks to a Supabase stack running on your machine, not the hosted
project, so you can wipe and reseed freely. `docs/DATABASE.md` covers the whole
setup, including how to point at the hosted project instead.

## Where to read next

**`docs/architecture/`** is the orientation for anybody new, human or
otherwise: what the product is, how the code is arranged, how access control
works, and a `gotchas.md` of bugs that each cost days. Read that before
debugging anything that "should work".

`CLAUDE.md` and `AGENTS.md` at the root are the same guidance in short form for
AI assistants. They are kept identical, so it does not matter which tool
somebody opens the repo with.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server plus the local API routes |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:start` / `db:stop` | Bring the local database up or down |
| `npm run db:reset` | Rebuild it from migrations, then seed |
| `npm run db:seed` | Load the demo dataset. Safe to re-run |
| `npm run db:new <name>` | New migration file |
| `npm run db:diff <name>` | Capture Studio changes as a migration |
| `npm run check` | Type-check, lint and the fast checks. Run before pushing |
| `npm run preflight` | Lint, type-check and build |

## Structure

```
src/
  app/          Router and app shell
  layouts/      Dashboard shells, one per role
  pages/        Screens, grouped by role: student, tutor, parent,
                counselor, admin, shared
  sections/     Marketing site sections
  components/   Shared UI. `messaging/` is the chat stack used by every role
  services/     Data access. One module per domain, all over supabase-js
  contexts/     Auth, breadcrumbs, topbar actions
  hooks/        Presence, typing indicators, and other shared hooks
  lib/          Supabase client, including the local/hosted switch
  utils/        Avatars, class names, small helpers
  config/       Development flags
supabase/
  migrations/   Schema. The source of truth, applied to local and hosted alike
scripts/
  seed.ts       Seeds either database from one dataset
  seed/data.ts  The dataset. Edit this to add demo data
  local-api.ts  Runs the /api routes locally, on Express
  verify/       One script per bug that already happened. Run by hand
api/
  *.ts          One serverless function each. Grouped by ?action=
  _handlers/    The handlers themselves. A leading _ means "not a route"
  _utils/       Supabase, Stripe, email, Zoom, fulfilment
docs/
  architecture/ Start here
  *.md          Setting up Stripe, Google, Supabase, and what is unfinished
```

## Deployment

The front end deploys to [Vercel](https://vercel.com) (see `vercel.json`);
Vercel auto-detects the Vite preset and the SPA rewrite keeps deep links
working. A production build defaults to the hosted Supabase project.

Nothing is tied to Vercel beyond that file and a couple of environment
variable names. `scripts/local-api.ts` already serves the same seven functions
under Express, so moving to any host that runs Node is a deployment change
rather than a rewrite. `docs/architecture/api.md` explains what the grouping
into seven files was for, and when it stops being necessary.

Database changes go out through `.github/workflows/database.yml`, which rebuilds
the schema from nothing on a clean runner and only then applies pending
migrations to the hosted project. See `docs/DATABASE.md`.

Before a real launch, work through `docs/PRODUCTION_UNMOCK_CHECKLIST.md`.
