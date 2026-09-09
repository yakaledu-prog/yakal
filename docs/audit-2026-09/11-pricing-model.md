# Monthly, one-time, or instalments

You asked which fits, and asked me not to be driven by rare cases. So this
starts from who actually buys, not from the edge.

## What is being sold, in two different shapes

Counselling and tutoring are not the same purchase and should not share a
pricing model. That is the first conclusion, and most of the rest follows.

**Tutoring is already right and should not change.** A family buys sessions,
pays for what they picked, and the money is held until each lesson happens. It
is a basket, not a subscription, and $99.98 for two lessons is a purchase
anybody understands. Leave it alone.

The question is only about counselling.

## The three options against a real year

A senior year runs roughly September to March: the college list in autumn, early
deadlines on 1 November, regular deadlines on 1 January, decisions in March. Call
it **seven months** of real work, with the load piled into October to December.

Take Premier at $250.

| | Monthly | One-time | Instalments |
| --- | --- | --- | --- |
| Family pays | $250 x 7 = $1,750 | $1,750 up front | $1,750 over 7 |
| Yakal receives | as it goes | all in September | as it goes |
| Family can leave | any month | not without a refund | depends on the terms |
| Counsellor is paid | per month worked | ? | per month worked |
| Failed card | pauses one month | cannot happen | breaks the plan |

The middle column is the tempting one and it is the wrong one, for three
specific reasons rather than a general preference.

**One-time collapses the escrow model you just built.** The whole point of
`earnings.period_end` is that a counsellor earns a month by working it. A single
September payment for seven months of work either sits in Yakal's balance until
March, which is the thing the escrow migration exists to avoid doing by accident,
or it pays out early, which is the bug this branch was opened to fix. Monthly
billing gives the ledger a natural period. One-time takes it away.

**One-time makes every refund a negotiation.** A family who leaves in November
has paid for March. There is no rule that computes what they are owed, so a
person decides, every time, under pressure, about several hundred dollars. With
monthly billing, leaving is cancelling, and the answer is "you keep the month you
paid for." That is a support policy you can write on one line.

**$1,750 on a card in one go is a different decision from $250 a month.** Card
limits aside, one is a purchase and the other is a family conversation. Monthly
pricing converts better for the same annual revenue, and it lets a family start
in September without having settled the whole year first.

## Instalments are monthly billing wearing a costume

Instalments differ from monthly in exactly one way: the family is committed to
the whole amount, so leaving early is a debt rather than a cancellation. That
buys Yakal predictable revenue and buys the family nothing. It also means
chasing a family for a missed payment on a service their child has stopped
using, which is a support burden and a reputational cost out of all proportion
to the money.

Stripe supports it, so this is a business decision rather than a technical one,
and the business answer is no.

## Recommendation: stay monthly, and add one thing

**Keep monthly billing exactly as it is.** It is built, it works, proration is
correct, and it matches how the money is earned.

The one gap worth closing is that **the calendar is lumpy and the price is
flat**. A family paying $250 in February for a month where nothing is due feels
it, and February is exactly when people cancel. Two honest ways to handle that,
both cheap:

1. **Say the shape out loud when they buy.** "Most families run September to
   March, seven months, about $1,750 for Premier." A family that understands the
   arc does not panic in February. This is copy, not code.
2. **Offer a prepaid year at a discount**, as an option beside monthly rather
   than instead of it. A family who wants to pay once can, and pays less for the
   certainty. This needs the discount work in `12-discounts.md`, and it is the
   only version of one-time payment worth building, because it is a choice
   rather than the only door.

Do the first before launch. The second when discounts exist.

## What not to do

- No metered billing, no credits, no rollover. A quota that expires monthly is
  already enforced and understood, and prepaid balances that can be refunded
  start to look like stored value, which is a regulatory question a tutoring
  company should not invite.
- No per-essay or per-hour pricing on counselling. It makes a counsellor bill
  their thinking time and makes a family ration advice.
