# Stripe on the deployed site

Written for test mode. No KYC, no business verification, no real money. Test
mode is a complete Stripe with its own keys, its own dashboard data and its own
webhooks, and everything in this app works there. Going live later means
swapping four values, not changing code.

Work top to bottom.

---

## 0\. The one idea

Two things have to line up, and each fails in a way that looks like the other.

|   | Getting money in | Hearing that it worked |
| --- | --- | --- |
| What it is | a Checkout session the server creates | a webhook Stripe posts back |
| Needs | `STRIPE_SECRET_KEY` | `STRIPE_WEBHOOK_SECRET` |
| Fails as | the Pay button errors immediately | you pay, and nothing unlocks |

The second is the one people skip, and it is the one that makes the app look
broken rather than erroring. Stripe takes the payment, the parent sees a
receipt from Stripe, and the course never appears, because the only thing that
marks it paid is the webhook.

There is **no publishable key** to configure. This app uses Stripe's hosted
Checkout: the browser is redirected to Stripe's own page and back. Nothing
Stripe-related runs in the browser, so nothing Stripe-related is in the bundle.

---

## 1\. Stripe dashboard: the keys

**Developers > API keys**, with **Test mode** toggled on. The toggle is at the
top right and every key below changes with it.

Copy two things:

*   **Secret key**, begins `sk_test_`. Reveal it first.
*   Leave the publishable key. This app does not use it.

A key beginning `sk_live_` is the wrong one for now and will refuse test cards.

---

## 2\. Vercel: the environment variables

**Project Settings > Environment Variables.** Add each to **Production** and
**Preview**.

Your `.env` file is not involved. It is read off your disk by the dev server
and never leaves your machine, so credentials you put there have no effect on
the deployed site. These are a separate copy.

| Variable | Value | What breaks without it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` from step 1 | every Stripe call, immediately |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 3 | payments succeed but nothing unlocks |
| `APP_BASE_URL` | `https://your-deployment.vercel.app` | see below |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase, Settings > API | the webhook cannot write |
| `VITE_SUPABASE_URL` | your project URL | everything |
| `VITE_SUPABASE_ANON_KEY` | your anon key | everything |

`APP_BASE_URL` deserves attention because its failure is silent and absurd. It
is what the server puts in Checkout's `success_url`, and it **defaults to
`http://localhost:5173`**. Leave it unset and a parent who has just paid real
attention and a test card gets returned to a page on their own machine that
does not exist. The payment worked. The redirect is nonsense.

Take the value from **Settings > Domains**, with `https://` and no trailing
slash.

Two more, only if they are already set:

*   `VITE_BACKEND` must **not** be `local` here. That points the deployed site
    at `127.0.0.1`, which on a visitor's machine is the visitor's machine.
*   Nothing server side may carry a `VITE_` prefix beyond the two above.
    Vercel publishes `VITE_` variables into the browser bundle, so a
    `VITE_STRIPE_SECRET_KEY` would hand your secret key to every visitor.

**Redeploy after adding them.** Vercel bakes environment variables in at build
time, so adding a variable does not change a build that already exists.

---

## 3\. Stripe dashboard: the webhook

This is the step you have not done, and the one that decides whether paying
does anything.

**Developers > Webhooks > Add endpoint**, still in Test mode.

**Endpoint URL:**

```
https://your-deployment.vercel.app/api/stripe-webhook
```

That exact path. It is its own serverless function, separate from
`/api/stripe`, because Stripe needs the raw unparsed body to check the
signature.

**Scope: Your account.** Leave the API version at whatever Stripe offers by
default; the SDK pins its own and the two agree.

**Events to send.** Four, and nothing else. Expand **Checkout** and **Invoice**
and tick:

```
checkout.session.completed
checkout.session.async_payment_succeeded
invoice.paid
invoice.payment_failed
```

The first marks a one-off course purchase paid. `invoice.paid` covers the
instalment plans, including the first charge when a subscription is created.

Do **not** tick any `v2.core.*` event. This app reads v1 payload shapes, so a
v2 event would arrive and do nothing. That rules out the entire "Account v2"
and "Account Person v2" groups, whatever their names suggest.

`account.updated` is deliberately not on this list. It belongs to the tutor
payout side and routes differently: see step 6.

Then **reveal the signing secret** on the endpoint you just created. It begins
`whsec_`. That is `STRIPE_WEBHOOK_SECRET` in step 2.

The signing secret is per endpoint. The one printed by `stripe listen` on your
own machine is a different secret for a different endpoint, and using it here
makes every real webhook fail signature verification with a 400. If billing
already works locally, that local secret is not the one to copy.

Redeploy once the secret is in.

---

## 4\. Check it

**Stripe dashboard, on the endpoint: Send test webhook > `checkout.session.completed`.**
Look for a `200`. A `400` means the signing secret does not match the endpoint.
A `500` means it arrived and the handler failed, and the reason will be in
Vercel's function logs.

**Then a real run.** Parent > Billing > buy a course. Card number:

```
4242 4242 4242 4242    any future expiry, any CVC, any postcode
```

Three things should follow, and which one fails tells you where to look:

1.  Stripe's payment page loads. If not, `STRIPE_SECRET_KEY`.
2.  You land back on Yakal's billing page. If you land on `localhost`,
    `APP_BASE_URL`.
3.  The course shows as paid. If it does not, the webhook, and
    **Developers > Webhooks > your endpoint** lists every attempt with its
    response.

Other cards worth knowing: `4000 0000 0000 9995` declines, and
`4000 0025 0000 3155` demands 3D Secure, which is worth trying once because a
real customer will meet it.

---

## 5\. What test mode does not do

Test and live are separate worlds and nothing crosses between them. Test
payments never appear in live reporting, test customers do not exist in live,
and the keys are not interchangeable.

Going live later, once KYC is done, is: swap `STRIPE_SECRET_KEY` to `sk_live_`,
create the webhook endpoint again in live mode, swap `STRIPE_WEBHOOK_SECRET`
to that endpoint's secret, redeploy. No code changes.

---

## 6\. Tutor payouts (Stripe Connect), only if you need it

The parent paying is step 4 and needs none of this. Paying tutors out is
Connect, and it is separate.

**Connect > Get started** in test mode, then pick **Express** accounts. Test
mode needs no KYC from you or from the tutors: onboarding is a form that
accepts obviously fake details, and Stripe fills the rest.

`account.updated` is what tells the app a tutor has finished onboarding.
Without it the tutor stays stuck on "complete your details" after they already
have.

It needs a **second event destination**, because the tutors are v1 connected
accounts and in v1 their events go to a destination scoped to **Connected
accounts**. Adding `account.updated` to the step 3 destination, which is scoped
to your own account, delivers nothing.

Before creating it, know that **each destination has its own signing secret**,
and the handler reads a single `STRIPE_WEBHOOK_SECRET`. A second destination
pointed at the same URL will fail signature verification with a 400 on every
delivery until the handler is taught to try more than one secret. Payments do
not need this. Only payouts do.

---

## When it breaks later

| What you see | What it is |
| --- | --- |
| Pay button errors instantly | `STRIPE_SECRET_KEY` missing, or a live key in test mode |
| Paid, but nothing unlocked | the webhook: wrong secret, wrong URL, or events not selected |
| Redirected to `localhost` after paying | `APP_BASE_URL` unset |
| Webhook attempts show `400` | signing secret belongs to a different endpoint, often `stripe listen` |
| Webhook attempts show `500` | it arrived; read the Vercel function log |
| Works locally, not deployed | you set it in `.env` and not in Vercel |
| Tutor stuck on "complete your details" | `account.updated` needs a Connected accounts destination, step 6 |

---

## What this does not cover

Refunds, disputes and partial payments are not handled anywhere in the app. A
refund issued from the Stripe dashboard takes the money back and leaves the
course marked paid in Yakal, because nothing listens for `charge.refunded`.
Worth knowing before a demo where somebody asks.
