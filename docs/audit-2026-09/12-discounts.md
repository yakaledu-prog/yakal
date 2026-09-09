# Discounts, and why they are not a price change

You asked whether an admin changing the price counts as a discount. It does not,
and the difference is worth being precise about, because the current code
conflates them in a way that already misinforms customers.

## They are different things

| | A price change | A discount |
| --- | --- | --- |
| Who it affects | everyone who buys from now on | one family, or one campaign |
| How long | until changed again | it expires |
| What the customer sees | the new price, as if it were always so | the full price, and what they saved |
| In the accounts | lower revenue | full revenue, less a marketing or aid cost |
| Reversible | only by another change | automatically |

The accounting line is the one that matters most. If Yakal gives ten families
half price and does it by lowering the tier price, the books say the product is
worth $125. If it does it with a discount, the books say the product is worth
$250 and Yakal spent $1,250 on acquisition or aid. Only the second is true, and
only the second tells you whether the discount worked.

## The current behaviour is a real problem, not a missing feature

Tested live. An admin raising Premier from $250 to $280:

- **New** subscribers correctly pay $280. `priceForTier` notices the tier price
  no longer matches the Stripe Price and creates a new one. That part is right.
- **Existing** subscribers keep paying $250, because a Stripe subscription item
  points at the Price object it was created with. That is also right, and is
  what any sane platform does.
- **The parent's billing page then says "$280.00 a month"**, because it reads
  `admissions_tiers.price_cents` rather than the subscription. Stripe will charge
  $250 on 9 October.

So the app tells an existing customer a number Stripe will not charge. Raising
the price overstates it; lowering it understates it, which is worse, because the
family finds out from their bank statement that they are paying more than the
app promised.

**This needs fixing whether or not discounts get built.** The plan card should
show what this subscription actually bills, taken from the subscription, with the
tier price used only for plans that do not have one yet.

## What to build

Stripe already models all of this and we should not invent a parallel system.

**Coupons** define the reduction: percent or amount, and how long it lasts
(once, repeating for N months, or forever). **Promotion codes** are the
customer-facing strings attached to a coupon.

Two cases, and Yakal needs both.

### A campaign code, entered by the family

One line in `stripe-checkout.ts`:

```ts
allow_promotion_codes: true,
```

Stripe then shows the code box, validates it, applies it and handles expiry.
Nothing is stored on our side, and the existing counsellor share already does
the right thing because it takes a percentage of **what actually came in** and
not of list price. The comment at `api/stripe-webhook.ts:123` says so:

> a discounted month should not pay a full one

That is a genuinely nice property. A half-price month pays the counsellor half.

### A per-family reduction, granted by an admin

This is the one that matters more for Yakal, and it is not really a discount.
It is **need-based aid**, and an Ethiopian company selling US admissions
counselling will be asked for it constantly. A family who cannot pay $250 but
can pay $100 is a customer worth having, and the difference between "we lowered
the price for everyone" and "we gave this family a place" is the whole business.

Applied as a coupon on the subscription rather than a different price, so:

- The family sees $250 with their award shown against it. They know what they
  were given.
- Reporting can total what Yakal awarded in a year, which is a number a
  scholarship programme has to be able to state.
- Removing it restores the full price with no migration.
- The counsellor is paid a share of what came in, automatically.

## Where it belongs in the admin

Not on the tier editor, and this is the one place I would push back on your
instinct. A tier is what the product **is**; a discount is something Yakal
**does**. Putting them on the same form makes it easy to do the damaging thing
by accident, which is to change the price when you meant to run a promotion.

Better: a small **Discounts** tab beside Tiers under Admissions, listing

- code, what it takes off, how long it repeats, when it expires, times used
- and, separately, which families have an ongoing award

with granting an award being an action on the family rather than a code they
type.

## Suggested order

1. Fix the displayed price so it comes from the subscription. Bug, not a
   feature, and it misinforms customers today.
2. `allow_promotion_codes: true`, plus a Discounts tab that creates Stripe
   coupons and codes. Small, and it covers launch promotions.
3. Per-family awards, when the aid programme is real enough to need them.

Nothing here needs a new table until step 3, and even then it is a thin record
of which Stripe coupon was granted to whom and why.
