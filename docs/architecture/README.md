# Architecture

Written for somebody who has just been handed this repository, with or without
an AI assistant sitting beside them.

Read in this order. Each one assumes the ones above it.

| | What it answers |
| --- | --- |
| [overview.md](overview.md) | What the product is, who uses it, what the main flows are |
| [codebase.md](codebase.md) | Where things live and why they are arranged that way |
| [data-model.md](data-model.md) | The tables, and how access control actually works |
| [api.md](api.md) | The serverless layer, and the two constraints that shaped it |
| [integrations.md](integrations.md) | Stripe, Google, Zoom, email, realtime |
| [gotchas.md](gotchas.md) | Things that cost days. Read before debugging anything |

Two more live one level up in `docs/`:

*   `PRODUCTION_UNMOCK_CHECKLIST.md` - **what is deliberately unfinished.**
    Read this before assuming something is a bug
*   `DATABASE.md` - the local stack, migrations and seeding

Setting up the third-party accounts themselves - Stripe keys and webhooks,
Google Cloud, a new Supabase project - is dashboard work rather than code, so
those walkthroughs are kept separately by the maintainer. Ask for them when you
need to stand up your own credentials.

---

## The short version

A React single-page app talks directly to Supabase for almost everything:
database, auth, file storage and realtime. A small set of serverless functions
exists only for work that needs a secret the browser must not hold - charging a
card, acting as the Yakal Google account, signing a Zoom token, sending mail.

There is no backend server of our own, no ORM and no API layer in front of the
database. Access control is Postgres row-level security, which means **a
missing policy is a security hole, not a broken feature**. That trade is the
single most important thing to understand about this codebase.

## What is deliberately not here

*   **No test suite.** `scripts/verify/` holds 31 scripts that each pin one bug
    that already happened, run by hand. About half drive a real browser and
    need the dev server and database up, so the all-in-one `npm run verify` is
    slow and flaky; run them individually. See CLAUDE.md.
*   **No CI beyond a deploy.** `preflight` is run locally before pushing.
*   **No staging environment.** There is local, and there is production.
*   **No error tracking.** Failures surface in the browser console and in the
    host's function logs.

These are reasonable for the size this is now, and each becomes wrong at some
point. Worth deciding deliberately rather than discovering.
