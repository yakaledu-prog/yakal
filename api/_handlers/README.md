# api/\_handlers

The route handlers, one file per endpoint, unchanged from when each was its own
serverless function.

They live behind an underscore because Vercel turns every top-level file in
`api/` into a serverless function, and the Hobby plan allows twelve. Sixteen
files meant no deploy at all. A leading underscore is Vercel's documented
opt-out: the file ships and can be imported, but it is not an endpoint.

The four group files above dispatch to these on `?action=`:

| Function | Actions |
| --- | --- |
| `api/stripe.ts` | `checkout`, `portal`, `confirm`, `payment-methods`, `create-invoice` |
| `api/connect.ts` | `onboard`, `status`, `transfer`, `session-payout` |
| `api/zoom.ts` | `signature`, `meetings` |
| `api/google.ts` | `token`, `drive` |

`contact.ts`, `dev-user.ts` and `stripe-webhook.ts` stayed top level. The
webhook has to: it sets `bodyParser: false` for Stripe's signature check, and
that config applies to a whole function.

Adding an endpoint means adding a file here and a line to the relevant group,
not a new function.
