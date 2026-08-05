# Things that cost days

Every entry here is a bug that actually happened. Read this before debugging
anything that "should work".

---

## Imports in `api/` need a file extension

`package.json` declares `"type": "module"`, so the deployed functions are ESM,
and **ESM relative imports must carry an extension**:

```ts
import { dispatch } from './_handlers/_dispatch';      // dies in production
import { dispatch } from './_handlers/_dispatch.js';   // correct, from a .ts file
```

Without it Node throws `ERR_MODULE_NOT_FOUND` before a single line of the
handler runs, and the platform answers `FUNCTION_INVOCATION_FAILED` with an
empty body.

**Nothing local catches it.** `tsc` resolves extensionless paths under
`moduleResolution: "bundler"`, and `tsx` does the same when the dev server
runs. It is invisible everywhere except production.

This took down five of the seven functions for weeks. The two survivors were
the only two importing nothing relative, which made it look like Stripe, Google
and Zoom each had their own unrelated problem.

`scripts/verify/api-esm-load.ts` compiles `api/` the way the host does and
imports the result **from a plain node subprocess** - deliberately not from the
tsx process running the check, which would resolve the very paths production
cannot. The first version of that check passed on the broken code for exactly
that reason.

## Invalidating a query only affects your own browser

`queryClient.invalidateQueries` cannot reach anybody else's session. When an
admin accepts a tutor's application, the tutor's cache has no idea anything
happened, and no amount of invalidation will fix it.

That is why `refetchOnWindowFocus` is **on** in `src/main.tsx` and freshness is
fifteen seconds. Coming back to the tab is what closes the gap without
subscribing to every table. Turning those off makes the app feel broken in a
way that looks like a caching bug and is not one.

Realtime subscriptions exist only where liveness genuinely matters: messages,
notifications, presence and typing. Adding more means adding tables to the
`supabase_realtime` publication first, or the subscription is silent.

## Realtime channels are cached by topic

`supabase.channel('x')` called twice returns **the same channel**. Calling
`.on('postgres_changes', ...)` on one that has already subscribed throws:

```
cannot add postgres_changes callbacks after subscribe()
```

Because both callers are usually effects mounting in the same commit, it throws
inside an effect and takes the whole page down through the error boundary.

Both `subscribeToMessages` and `subscribeToNotifications` are therefore
ref-counted with a shared listener set: the callback is attached exactly once,
before subscribe, and the channel is torn down when the last subscriber
releases it. **Any new subscription must follow that pattern.**
`scripts/verify/realtime-refcount.ts` pins it.

## Environment variables are baked in at build time

Adding one to the host does nothing to a build that already exists. Redeploy.

Locally, `dotenv` reads `.env` once at boot, so changing a credential while the
API server is running leaves it holding the old one. Restart it. The symptom is
an "expired" or "missing" credential that is plainly correct on disk.

## `VITE_` publishes to the browser

Vite inlines every `VITE_` variable into the bundle. `VITE_SUPABASE_ANON_KEY`
and `VITE_GCP_CLIENT_ID` are meant to be public. Anything else with that prefix
is a leak.

The reverse trap: `VITE_BACKEND=local` set on a deployment points the live site
at `127.0.0.1`, which on a visitor's machine is the visitor's machine.

## Google says the same thing for two different problems

`Requested entity was not found` means **either** the Classroom id is wrong
**or** the class belongs to a different Google account. Identical wording,
completely unrelated fixes.

The id in a `/c/` URL is base64: `/c/ODE5OTE1NjYyMzIx` is course
`819915662321`. Passing the encoded form gets that error and sends you
rebuilding an OAuth client that was never broken.

## Google refresh tokens expire weekly while the app is in Testing

Not the access token, the refresh token. Publishing the OAuth consent screen
stops it. This is the reason Drive and Classroom appeared to break roughly
every seven days for no reason. The Google Cloud walkthrough is kept with
the setup notes; ask for it.

## A webhook signing secret belongs to one endpoint

Stripe issues a different `whsec_` per destination. The one printed by
`stripe listen` on your machine is a different endpoint's secret, and using it
in production makes every real delivery fail signature verification with a 400.

The symptom is the worst kind: the payment succeeds, Stripe shows a receipt,
and nothing unlocks, because **the webhook is the only thing that grants
access**.

## `tsx` hides resolution bugs from your tests

`tsx` installs a resolver for the whole process, so a check that imports
compiled output under `tsx` will resolve paths that production cannot. Verify
scripts that test module loading must shell out to plain `node`.

The same applies in reverse: `scripts/verify/_vite-run.mjs` exists because
anything under `src/` may read `import.meta.env`, which does not exist under
plain `tsx`. Use it when a verify script needs to import application code.
