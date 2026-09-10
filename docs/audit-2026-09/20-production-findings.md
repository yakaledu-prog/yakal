# Production, 10 September 2026

Tested against yakal.me after pushing the September work. Local findings are in
the other files here; this is only what differs once deployed.

## 1. The scheduled job has never run. No tutor has ever been owed anything.

Three independent symptoms, all from the live site:

- Lessons from **17, 18 and 19 August** still read "started 527 hours ago" on
  the tutor's own Sessions page. That label only appears while a session is
  `upcoming`. Three weeks after they finished, they have never completed.
- Admin billing: **$19,687.86 revenue, and PAYOUTS DUE $0.00**, with "Nothing
  owed. Everybody is settled."
- Bethlehem Alemu has **12 sessions across 3 students** and her Earnings page
  says **$0.00, 0 sessions taught**.

`run-jobs` is the one thing that completes a finished lesson and writes the
earning behind it. Nothing else does, deliberately: a tutor marking their own
session complete is a tutor authorising their own payment. So if it never runs,
no session ever completes, no earning is ever written, and no tutor is ever paid
however much the families have paid in.

**OUTSTANDING of $11,565.00 is the same fault seen from another side.**
`voidStaleInvoices` is part of the same job, so abandoned checkouts have been
accumulating as outstanding revenue for weeks instead of being closed after
seven days.

The job is not part of the deploy. It is a `pg_cron` schedule that has to be
created once in the Supabase SQL editor, and `docs/PAYMENTS_SETUP.md` carries
the statement to run. Either it was never created, or the `JOBS_TOKEN` it sends
does not match the one on Render.

**This is the first thing to fix.** Everything else in the payment system is
downstream of it, and it is a few minutes of work: run the `cron.schedule`
statement from `PAYMENTS_SETUP.md` against production with the right token, then
call the endpoint once by hand and watch the numbers move.

I could not verify the cron myself: the endpoint answers `401` without the
production `JOBS_TOKEN`, and that same `401` is what it returns whether the
token is wrong or unset, so it cannot tell the two apart from outside.

## 2. Zoom cannot work in production. One environment variable.

`VITE_ZOOM_MEETING_CLIENT_ID` on the deployment is set to
**`your-meeting-sdk-client-id`**, the value from `.env.example`.

Decoded straight from the live site:

```
POST https://yakal.me/api/zoom?action=signature
  {"meetingNumber":"88082791691","role":0}

{"appKey":"your-meeting-sdk-client-id","mn":"88082791691","role":0,...}
```

The Meeting SDK reads `appKey` out of the signature, so every join is being
handed a token signed for an application that does not exist. Zoom refuses it
the moment somebody presses Join.

**What made it invisible:** the handler checked the credentials were *present*,
and a placeholder is a perfectly good non-empty string. So it answered `200`
with a valid-looking signature. The browser cannot tell a good signature from a
bad one, so there is no error to see anywhere: the first symptom is a person
sitting in front of a meeting that will not open, with nothing in any log.

Fixed so it refuses anything still shaped like an example and names the
variables an administrator has to set. A `500` that says what is wrong is worth
more than a `200` that cannot work. Pinned by
`scripts/verify/zoom-signature.ts`.

**Still to do, and only you can:** set `VITE_ZOOM_MEETING_CLIENT_ID` and
`ZOOM_MEETING_CLIENT_SECRET` on Render to the real Meeting SDK credentials.
The server-to-server variables (`ZOOM_S2S_*`) are a different app and are worth
checking at the same time, since those are what create the meetings.

One correction to something I said while testing: I claimed the placeholder was
in the frontend bundle too. It is not. The client id is never baked into the
browser; the SDK takes it from the signature. This is one variable, server side.

## 3. Stripe on production is a sandbox, so no real money can be taken

The checkout page says it in its own header: **"yakal sandbox"** with a
**Sandbox** badge, and the session id comes back as `cs_test_...`.

That is the right setting for testing and it is worth knowing deliberately
rather than discovering on launch day: as it stands the deployment cannot
accept a real payment from anyone.

Because it is test mode, I put a real purchase through it end to end, and the
whole chain works:

- checkout session created, card `4242...` accepted
- **Stripe's webhook reached the deployed server and was accepted**, which is
  the half only production can prove
- the invoice was fulfilled: "Paid to date" moved from $1,259.30 to $1,319.30
- the session was created **with a Zoom meeting attached**

That last point matters for the Zoom finding above: the server-to-server
credentials that *create* meetings are fine. It is only the Meeting SDK
credentials that *join* them that are placeholders. Two different Zoom apps,
and only one is broken.

## 4. Two things about the checkout page itself

**Stripe Link takes over the form for a returning customer.** Paying as
`parent@yakal.com`, Checkout did not show a card form at all. It showed Link's
"Confirm it's you, enter the code sent to (...)15". There is a "Pay without
Link" link underneath, and it works, but a family who has ever used Link
elsewhere meets a verification code before they can pay.

`stripe-checkout.ts` already sets `payment_method_types: ['card']` and its
comment says that is to stop Checkout leading with the wallets. It does not
stop Link. Turning Link off is a switch in the Stripe dashboard, under payment
methods, not something the code can do.

**The currency chooser leads with AED.** The page offers "AED 229.17" first and
"$60.00" second, for a $60 course, with the exchange rate underneath. This is
Stripe's adaptive pricing guessing from the browser. For a US company billing US
families it is a conversion problem at the worst possible moment, and it is a
dashboard setting: turn adaptive pricing off, or pin the presentment currency on
the session.

## 5. What is fine

- The site is up, serving, and the health of the API routes is right: the jobs
  endpoint answers `401` without its token, the refund endpoint answers `401`
  without a session, and the signature endpoint validates its input.
- Supabase points at the hosted project, not local.
- The migrations from this work applied cleanly. The `Database` workflow builds
  the schema from nothing on a clean runner, seeds it, checks it, and only then
  pushes to the hosted project, and it passed.
- CI passed on the same commit.

## 6. Confirmed against production after the deploy

All of these were re-checked on yakal.me once the deploy landed, and all hold:

- the install card shows on the landing page and is gone from `/login`
- `/` puts a signed-in visitor straight on their dashboard, with no flash
- `/login` sends a signed-in visitor to their dashboard
- the student home shows real figures (3 courses, 3 completed, 5 upcoming,
  2 due) rather than the old hardcoded 12 and "A-"
- diagnostics load from the database: a real "Grade 9 Algebra" test with a
  stored 7/20 result, and the review reads its answer key from the stored row
- **anon can no longer read the diagnostics table.** Before today the whole
  answer key was readable over REST by the public internet, signed out
- `profiles` is denied to anon, `invoices` returns an empty set, `blog_posts`
  is public as intended
- the meeting page now fails honestly. Opening a session on production says
  "Could not get a join signature from the server: Zoom is not configured on
  this deployment", where before it was handed a signature that looked fine and
  simply would not open

One correction to a local finding: **production tiers already have counsellor
shares configured.** The amber "No counsellor share set" warning does not
appear on any of them, so the "no counsellor can be paid" problem in
`10-payments-findings.md` was local seed data, not production.

## 7. The advising wall is real on production too

Booking an advising hour as a student on yakal.me opens onto:

> This counsellor has not published any hours yet. Send them a message and they
> can open some.

That is the corrected wording from this work, and the fact that it says
"counsellor" rather than "tutor" and offers a next step is the fix landing. The
wall itself is the finding: the counsellor on a live, paid plan has published no
availability, so the family cannot book the thing they are paying for. Same as
`03-counsellor-experience.md` describes locally, with real families on the other
side of it.

## 8. Environment, separately

`VITE_DEV_PREVIEW` is on in the production build. The app logs it itself on
boot:

```
[YAKAL] DEV_PREVIEW is ON in a production build: demo logins and /preview are
public. Unset VITE_DEV_PREVIEW to close them.
```

That leaves the demo logins and the `/preview` routes reachable by anybody. Fine
while this is a testing deployment, not fine on the day real families arrive.
