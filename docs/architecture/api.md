# The serverless layer

Seven functions in `api/`. They exist only for work that needs a secret the
browser must not hold. Everything else goes straight from the browser to
Supabase.

| File | Actions | Why it cannot be client-side |
| --- | --- | --- |
| `stripe.ts` | checkout, portal, confirm, payment-methods, create-invoice | Stripe secret key |
| `stripe-webhook.ts` | - | needs the raw body to check a signature |
| `connect.ts` | onboard, status, transfer, session-payout | Stripe secret key |
| `google.ts` | token, drive, classroom | acts as the Yakal Google account |
| `zoom.ts` | signature, meetings | signs with the Zoom secret |
| `contact.ts` | - | Resend API key |
| `dev-user.ts` | - | service role, disabled in production |

---

## Two constraints shaped all of this

### Twelve functions

**Every top-level file in `api/` becomes its own serverless function**, and the
free plan allows twelve. Sixteen endpoints did not fit, so related ones were
grouped behind a single file that dispatches on `?action=`:

```ts
export default dispatch({
  'token': () => import('./_handlers/google-token.js'),
  'drive': () => import('./_handlers/drive.js'),
  'classroom': () => import('./_handlers/classroom.js'),
});
```

Files and folders starting with `_` are **not** routed, which is what makes
`_handlers/` and `_utils/` possible.

Routes given as `() => import(...)` are loaded only when that action is asked
for. That is not an optimisation: the Google token exchange is plain `fetch`
against Google's OAuth endpoint and needs no SDK, but it sat behind top-level
imports of the Drive and Classroom clients, so anything that stopped those from
loading stopped the token exchange too.

`_dispatch.ts` also catches whatever a handler throws and answers as JSON. A
throw outside a handler's own `try` used to get the platform's HTML error page,
which the browser could not parse, so every failure reached the client as the
same unhelpful message with the reason stranded on the server.

If you move off a host with a function limit, this grouping stops being
necessary and the handlers can go back to being one file each. Nothing else
depends on it.

### Two hundred and fifty megabytes

Each function is bundled with everything it imports and rejected over the
limit. The `googleapis` metapackage is **204 MB** and pushed `google.ts` past
it, so every Google call returned `FUNCTION_INVOCATION_FAILED` with an empty
body. Replaced with `@googleapis/drive` (2.5 MB) and `@googleapis/classroom`
(1.7 MB).

The general rule: **prefer the per-API package**. A metapackage that carries
every Google API to use one of them is the shape of problem to watch for.

---

## Writing one

Handlers keep the signature they had as standalone endpoints:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);   // throws if the token is bad
  ...
}
```

Three things that are not optional:

1.  **`import type`**, not `import`, for the Vercel types. They are types only,
    and `@vercel/node` is a devDependency that is not installed in the deployed
    runtime.
2.  **The `.js` extension** on every relative import, even from a `.ts` file.
    See [gotchas.md](gotchas.md).
3.  **Import auth from `_utils/supabase.js`, not `_utils/billing.js`.** They
    were together once, and importing `requireUser` pulled the 16 MB Stripe SDK
    into functions that bill nothing.

## Running them locally

`scripts/local-api.ts` is a 56-line Express server that imports the same seven
entry points and serves them on 3001. `npm run dev` starts it alongside Vite.

It is worth knowing that this file exists for a second reason: **it is also a
working port to any host that runs Node.** Nothing in `api/` depends on the
platform beyond a request and a response object.
