# The outside world

Five external services. Each has an operational guide in `docs/`; this is what
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

The scopes are `drive.file` plus four Classroom scopes.
`api/_handlers/drive.ts` also declares full `auth/drive`, but only on the
service-account path, which is unused - see the checklist, because that is a
restricted scope with real consequences if it ever goes live.

## Zoom

Server-to-server OAuth creates meetings; a separate meeting SDK credential
signs the client-side join. `api/_utils/zoom.ts` caches the token until it
expires.

## Email

`api/_utils/email.ts` sends through **Resend in production** and **SMTP to
Mailpit otherwise**, decided by `VERCEL_ENV`/`NODE_ENV` plus the presence of a
key. A production key sitting in a local `.env` therefore cannot send real
mail by accident.

Only two places send: the contact form, and five messages on the Stripe
fulfilment path. **Notably, inviting a child sends nothing** - the invite is
recorded and claimed when that address signs up. If email matters to a feature
you are adding, check whether it is actually wired.

While Resend is on its shared `onboarding@resend.dev` sender, it will only
deliver to the address the Resend account is registered under. Verify a domain
before expecting mail to reach anybody else.
