# The outside world

Six external services. Each has an operational guide in `docs/`; this is what
the code does with them and where the seams are.

---

## Supabase

Database, auth, storage and realtime. The browser talks to it directly with the
`anon` key; `api/` talks to it with the service-role key when it needs to
bypass RLS.

`api/_utils/supabase.ts` picks which project to talk to. The rule matches the
frontend: an explicit `BACKEND` flag wins, otherwise production means the
hosted project and anything else means the local Docker stack. This exists
because the API used to always use the hosted project, so in development it
handed a token issued by the local stack to the hosted project's auth, which
rightly rejected it, and every billing call came back 401.

**Storage buckets**: `avatars` (upload scoped to your own id), `resumes`,
`testimonials` (admin-only write). A new bucket needs its policies in a
migration, in `storage.objects`.

**Realtime publication**: `messages`, `notifications`, `conversations`,
`conversation_participants`. A table not in that publication produces a silent
subscription, not an error.

## Stripe

Hosted Checkout, so **no publishable key and nothing Stripe-related in the
browser bundle**. The server creates a session, the browser is redirected to
Stripe and back.

`stripe-webhook.ts` is a separate function because Stripe signs the raw body
and any framework that parses it first breaks verification. Five events are
handled: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `invoice.paid`,
`invoice.payment_failed`, `account.updated`.

**The webhook is the only thing that grants access.** The redirect back from
Stripe unlocks nothing, deliberately: a customer who closes the tab has still
paid.

`account.updated` is about **connected** accounts, so in Stripe's v1 model it
needs a destination scoped to Connected accounts, which is a second endpoint
with a second signing secret. The handler currently reads one
`STRIPE_WEBHOOK_SECRET`, so tutor payouts need that resolved before they work.
The Stripe dashboard walkthrough is kept with the setup notes; ask for it.

## Google

Two independent paths that fail differently, which is why Google problems look
chronic:

| | Server side | Browser side |
| --- | --- | --- |
| Who | one Yakal account, always | the signed-in admin |
| Credential | `GOOGLE_OAUTH_REFRESH_TOKEN` | a token from a sign-in popup |
| Used by | Drive documents, reading Classwork | the admin's Fetch Details button |

**Students and tutors never sign in to Google.** They read Classwork through our
server, which checks they are on the course and then asks Google as the one
account. Booking the course is what grants access. The only browser sign-in is
an admin linking a class, because that is the one moment somebody has to pick
from their own classes.

The scopes are `drive.file` plus five Classroom scopes.
`api/_handlers/drive.ts` also declares full `auth/drive`, but only on the
service-account path, which is unused - see the checklist, because that is a
restricted scope with real consequences if it ever goes live.

Wiring an account up from nothing, and what each scope is for, is
`docs/GOOGLE_SETUP.md`.

## Zoom

Server-to-server OAuth creates meetings; a separate meeting SDK credential
signs the client-side join. `api/_utils/zoom.ts` caches the token until it
expires.

## Email

`api/_utils/email.ts` sends through **Resend in production** and **SMTP to
Mailpit otherwise**, decided by `VERCEL_ENV`/`NODE_ENV` plus the presence of a
key. A production key sitting in a local `.env` therefore cannot send real
mail by accident.

Three places send: the contact form, five messages on the Stripe fulfilment
path, and `api/invites.ts`, which mails a child their invitation link. The
invite row is created in the browser under the parent's own session, so RLS has
already decided they may; the endpoint only turns an existing invite into an
email, and reads it through the caller's client so a parent can only mail their
own. If email matters to a feature you are adding, check whether it is actually
wired.

**`EMAIL_PROVIDER` overrides the choice**, and is the only way to reach a real
inbox from a development machine. Without it a production key in a local `.env`
still sends to Mailpit, which is the property worth keeping; naming the provider
is not an accident. Set it back to `smtp`, or remove it, when you are done.

Local sends failing at the socket usually means Mailpit is running with no
published ports: `docker ps` shows `supabase_inbucket_*` with an empty Ports
column, and 54324 and 54325 refuse connections. Restarting the Supabase stack
republishes them.

While Resend is on its shared `onboarding@resend.dev` sender, it will only
deliver to the address the Resend account is registered under. Verify a domain
before expecting mail to reach anybody else.

## Sentry

Error reporting, browser and server, and **entirely optional**: it is a no-op
unless a DSN is set, so local runs and tests report nothing.

| | Browser | Server |
| --- | --- | --- |
| Variable | `VITE_SENTRY_DSN` | `SENTRY_DSN` |
| Read at | build time | run time |

Because the browser DSN is read at build time, an unset one lets the bundler
remove the SDK entirely: with no DSN the cost is zero bytes, and with one it is
a lazily loaded chunk of roughly 143KB gzipped that never blocks first paint.
Setting it therefore requires a rebuild, not just a restart.

**Nothing is sent unscrubbed.** This process holds the service-role key,
Stripe's secret and a Google refresh token, and all three have appeared in error
messages. Request bodies, headers, cookies and query strings are dropped; a user
is reduced to an id; and credential-shaped strings are redacted out of the
message itself. `scripts/verify/error-scrubbing.ts` pins that, and it is in
`npm run check`.

Tracing and session replay are both off. Tracing because the question is what
broke, not what was slow, and replay because it records the screen and the
people on the other side of it are children.

## Health

`GET /api/healthz`, mounted by both servers and deliberately **not** an
`api/*.ts` file: every top-level file there is a deployed function and Vercel's
plan allows twelve, which is how many there are.

It reports configuration, not a pulse. "Alive but with no Google credentials"
was the failure that kept happening, and a process check would have called it
healthy every time. It answers 503 when any component is wrong, so an uptime
monitor needs to read nothing.

Public callers get the verdict only. The detail names which integration is
broken, which is a map for somebody probing, so it needs `HEALTH_TOKEN` as a
`?token=` or an `x-health-token` header. With no token configured the detail is
never served rather than served to everyone.
