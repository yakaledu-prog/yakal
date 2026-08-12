# Two servers have to agree about `api/`

## The trap

`api/` follows Vercel's file convention: every top-level `.ts` file is one
function, files starting with `_` are not routed, the free plan allows twelve,
and relative imports need a `.js` extension because the deployed functions are
ESM.

Production is not Vercel. `npm start` runs `scripts/server.ts`, a single
long-lived Express process, and it mounts every endpoint **by hand**. Local
development runs `scripts/local-api.ts`, which also mounts every endpoint by
hand, in a separate list.

So a new file in `api/` has to be registered in two places that nothing checks
against each other. Register only the dev one and the endpoint works through
development, through review, through the whole PR, and 404s the instant it
ships. The failure looks like a routing problem in production and cannot be
reproduced locally, which is the expensive part.

This has happened twice:

- `/api/invites`, so a parent's invitation 404'd in production.
- `/api/ai`, the landing assistant, same shape.

The comment in `scripts/server.ts` above `'/api/invites'` records both.

## The fix, when someone has time

Auto-mount. Have both servers read the `api/` directory and mount every file
that does not start with `_`, at `/api/<basename>`, which is what Vercel does
from the same convention. Then adding a function is one file again and cannot
be half-registered.

Roughly thirty lines, in `scripts/server.ts` and `scripts/local-api.ts`, or
once in a shared helper both import. Points to watch:

- `stripe-webhook` must stay mounted **before** the JSON body parser and with
  `express.raw`, because Stripe signs the exact bytes it sent. Auto-mounting
  has to special-case it or mount it first and skip it in the loop.
- The imports are static today, which is what lets `tsc` check them. Reading a
  directory means dynamic `import()`, so a typo in a filename becomes a runtime
  failure rather than a compile error. `scripts/verify/api-esm-load.ts` already
  loads every file in `api/` and asserts it exports a handler, so that check
  covers most of what is lost.
- Keep `/api/dev-user` guarded. It refuses on its own when `NODE_ENV` or
  `VERCEL_ENV` is production, so auto-mounting it is safe, but that guard is
  what makes it safe and should not be removed later by someone tidying up.

## Should this be rewritten as a plain Express app?

Considered and declined, for now.

The handlers are already plain `(req, res)` functions. There is no Vercel SDK
in the request path, so "moving to Express" would not delete a dependency or
change how a handler is written. What it would delete is the twelve-function
grouping: `api/stripe.ts` dispatching on `?action=` to `_handlers/stripe-*.ts`
exists only because Vercel counts files, and on Express those could be ordinary
routes.

That is a large diff across every endpoint in exchange for tidiness rather than
capability, and it gives up the option of deploying to Vercel later. Auto-
mounting removes the actual failure mode for a fraction of the work, so do that
first and revisit this only if the Vercel target is formally dropped.
