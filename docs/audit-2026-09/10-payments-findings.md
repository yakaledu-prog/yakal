# Payments, tested end to end

Everything below was run against Stripe test mode with `stripe listen`
forwarding real webhooks to the local API. That last part matters: `.env` had
`STRIPE_WEBHOOK_SECRET=whsec_...  # from step 5`, a placeholder, so **no webhook
had ever been verified on this machine before today**. Refunds, `invoice.paid`
and subscription changes all arrive by webhook, which is a good part of why this
was hard to test by hand.

## What works, confirmed against Stripe rather than against our own rows

**The tutoring money path is correct end to end.** Walked as a parent:

1. Picked two slots, $99.98, real Stripe Checkout, card `4242...`.
2. Webhooks arrived and every one returned 200: `charge.succeeded`,
   `payment_intent.succeeded`, `checkout.session.completed`, `charge.updated`.
3. `invoices` row went to `paid` with the charge id. Two `sessions` rows created
   at the times picked.
4. **No earning was written**, which is right: the lessons had not happened.
5. Aged the sessions, ran `run-jobs`. Two earnings of $35.00 appeared, `pending`,
   held 72 hours, each carrying the funding charge.
6. Released the hold, ran the job again, and two real transfers went out.

Verified on Stripe, not inferred:

```
tr_3UDpBCQ...ZGEseNk  3500 usd -> acct_1U5Y4uPrbyjkCgkN  source: ch_3UDpBCQ...
tr_3UDpBCQ...6dQkqWe  3500 usd -> acct_1U5Y4uPrbyjkCgkN  source: ch_3UDpBCQ...
connected account balance: pending 7000 usd
```

Both transfers draw on the exact charge the parent paid. The escrow rule holds.

**The KYC-incomplete case behaves correctly.** With no `stripe_account_id` the
release step skipped both earnings and left them pending rather than failing or
paying blindly. The guard trigger on `profiles` also refused to let the Connect
account be set by hand, which is right.

**Subscriptions work, including proration.** Subscribed for $120, then upgraded
to Premier. The dialog explained it in plain English:

> Charged today $130.00. Then from October 9, $250.00 a month.
> Today's amount covers the rest of this month at the new rate, less what you
> have already paid for it.

Stripe agreed: subscription now 25000 usd monthly, with a `subscription_update`
proration invoice. This is good work and needs no changes.

**The refund dialog is the best screen in the product.** It says what the refund
costs before it happens:

> Back to the parent $99.98
> Yakal absorbs $70.00
> 2 payments have already gone out for work that was delivered. Refunding the
> parent does not bring that back, and it cannot be recovered from here.

**The counselling escrow hole is closed**, and by a better route than was
planned. Rather than deferring the earning to a period-close job, the row is
still written at renewal so the counsellor can see what the month is worth, and
`earnings.period_end` makes the hold run to the end of the paid period, with the
release refusing a period in which nothing was delivered. No new job step, no
new plan column, and the counsellor keeps visibility. `20260824000100_counselling_escrow.sql`.

---

## What is broken

### 1. No counsellor can ever be paid. Launch blocker.

All three tiers have `counselor_share_percent` set to NULL.

```
key        name        price_cents   counselor_share_percent
essential  Essential   12000         (null)
premier    Premier     25000         (null)
elite      Elite       45000         (null)
```

`counsellorShare()` returns 0 for a null share, and
`recordCounsellingEarning()` returns early on `amountCents <= 0`. So the row is
never written. Confirmed live: subscribed for real, plan active with a Stripe
subscription and a period end of October 9, and `earnings` has no
`counselling_month` row at all.

The code is right. The configuration is empty, the admin tier editor treats the
field as optional, and nothing anywhere warns that a live tier pays its
counsellor nothing. A counsellor would work a full month before anyone noticed.

**Fix:** refuse to activate a tier with no share, or warn loudly on the tier
list. The field already exists at `AdminTierModal.tsx:318`.

### 2. A refund leaves no trace anywhere a human looks. Launch blocker.

The refund itself is correct. Stripe shows the charge fully refunded, and a
`refunds` row is written with status `succeeded`. But:

- `invoices.status` stays `paid`. The check constraint has no `refunded` value,
  which is a defensible normalisation, except that nothing then reads `refunds`.
- The admin invoice list still shows **Paid** with an active **Refund** button.
- **`revenueCents` sums every invoice with status `paid` and never subtracts
  refunds** (`src/services/adminService.ts:101`). Revenue overstates income by
  the value of every refund ever issued, permanently and cumulatively.
- The parent's billing page still reads **"Paid $99.98"** and
  **"PAID TO DATE $219.98"**, with no sign a refund happened.

A family refunded $99.98 has to check their bank to know it worked. That is a
support ticket every time, and the revenue figure is one a business would
actually make decisions on.

**Fix:** join `refunds` in the invoice query, show a refunded state, and
subtract refunds from revenue. No schema change needed.

### 3. Two payout failures tell nobody

`releaseDueEarnings` has four skip reasons and only one notifies:

| Reason | Someone is told |
| --- | --- |
| `nothing to transfer` | not needed |
| `nothing delivered` | yes, admins, once |
| **`no connected account`** | **no** |
| **`platform balance not settled`** | **no** |

Both silent ones mean a person is owed money and did not get it. The second is
worse: it means Yakal's own balance is short and payouts are quietly stalling.
The only evidence is a JSON response from a cron job nobody reads.

**Fix:** the `adminNotice` template and `tellAdmins` already exist. This is a
few lines beside the existing `NOTHING_DELIVERED` branch.

### 4. Stripe Checkout offers the wrong currency

Checkout presented **AED 381.84** as the headline price with a currency chooser,
for a $99.98 USD charge, on an Ethiopian company's US account. This is Stripe's
adaptive pricing guessing from the browser. It is a dashboard setting rather than
a code change, but a family in Addis being quoted UAE dirham is a conversion
problem and a trust problem.

**Fix:** turn adaptive pricing off in the Stripe dashboard, or pin the
presentment currency on the Checkout Session. Decide deliberately rather than
inherit the default.

---

## Smaller things

- **Abandoned checkouts inflate "OUTSTANDING".** Each one leaves an `open`
  invoice, counted in the admin's outstanding figure until `voidStaleInvoices`
  closes it after 7 days. Self-correcting, but the word "outstanding" implies
  collectable and these are abandoned carts. The parent's wording,
  "Not finished", is better.
- **Proration preview is a cent out.** The dialog said $130.00; Stripe charged
  $129.99. Trivial, but it is a money figure shown to a customer who can compare
  it to a card statement.
- **The change-plan dialog offers Confirm when it cannot confirm.** On a plan
  with no `stripe_subscription_id` it says "This plan has no subscription
  attached, so it cannot be changed here" and leaves the Confirm button enabled.
  Clicking it returns a 400.
