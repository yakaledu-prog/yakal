# Yakal Education Services: a briefing

Written to be read by someone advising on payments and Stripe. It describes the
product, the people in it, how money moves, and what is genuinely unresolved.
There is no code in it.

Last updated 18 August 2026.

---

## 1. What Yakal is

Yakal Education Services is an Ethiopian education company that sells two things
to families:

- **Tutoring.** One-to-one lessons in school subjects, booked as individual
  hours against a particular tutor's calendar.
- **College admissions counselling.** A months-long engagement helping a student
  apply to universities abroad: essay rounds, a balanced school list, interview
  practice, deadline tracking.

The software is a web application the whole company runs on. Families buy
through it, tutors and counsellors work through it, and administrators run the
business through it. It is live, at yakal.me, with a small number of real users
and a large amount of demo data.

The company is based in Addis Ababa. Its customers are Ethiopian families.
Prices are quoted and charged in **US dollars**. This tension between where the
business is and what currency it charges in runs through much of what follows.

---

## 2. The people in it

Five kinds of account, each with a different relationship to money.

### The parent

**The only person who ever pays.** A parent creates an account, invites their
children by email, and buys services for them. They see billing, invoices,
saved cards, and their children's progress. Nothing a child does can spend
money.

A parent may have several children. Each purchase names one.

### The student

The person the service is actually for. They see their courses, the work set on
them, their sessions, and their college application. **A student never sees a
price and never buys anything.** They are the consumer of something bought on
their behalf.

Students are often minors. Some are old enough to hold their own email and
Google account; the company has decided parents will create one for children who
do not.

### The tutor

Teaches subject lessons, an hour at a time, against a calendar of availability
they publish. **Tutors are paid per session taught.** A tutor is a contractor,
not an employee. They connect a bank account through Stripe and receive money
for sessions they have delivered.

Tutors do not set their own rates. That is deliberate and firm: pricing is the
administrator's alone.

### The counsellor

Runs admissions engagements. Unlike a tutor, a counsellor is not paid per hour
of contact. A family buys a **tier** — a months-long package with quotas for
essay rounds, advising sessions and interview practice — and the counsellor
carries that family for the length of it.

Counsellors have historically been paid outside the platform entirely.

### The administrator

Runs the business. Creates courses and tiers, sets every price, approves tutors
and counsellors, assigns students, watches revenue, and pays people. There is no
self-service pricing anywhere: **every amount a customer sees was typed by an
administrator.**

---

## 3. What is actually sold

### Tutoring, sold by the hour

An administrator creates a **course** — say "Advanced Mathematics, University
Entrance Prep". A course has a subject, a description, a thumbnail, a price per
session, a tutor payout per session, and one assigned tutor.

A course with no tutor never appears to parents, because there is no calendar to
book against.

A parent browses the catalogue, opens a course, picks a child, and selects
specific hours from the tutor's published availability. The total is the per
session price multiplied by the number of hours chosen. They pay once, for that
block of hours.

So tutoring is **prepaid, in blocks, at an hourly price**, even though it is not
presented as an hourly product. There is no subscription, no retainer, and no
option to pay per lesson as it happens.

### Admissions, sold as a tier

An administrator creates **tiers** — currently Essential, Premier and Elite.
Each has a total price, a set of quotas, and a number of monthly instalments
between one and twenty-four.

A family buys a tier for a child. If the tier is set to one instalment they pay
the total once. If it is set to ten, they pay a tenth each month for ten months
and the arrangement ends there. It is a subscription with a fixed end, not an
open-ended one.

**The whole engagement is granted on the first payment.** A family that has paid
one instalment of ten has the same access as one that has finished paying. The
instalments are how the money is collected, not how the service is released.

---

## 4. The rule that governs access

This is worth stating plainly because it was hard won and it constrains payment
design.

**Access follows payment, and payment alone.**

A student can use tutoring if and only if somebody has bought them a course. A
student can use admissions if and only if somebody has bought them a tier. There
is no separate switch that grants access, and a parent cannot toggle a service
on without paying for it.

There is a legacy per-child permission setting that predates this rule. It is
kept as an administrative override and is not part of the access decision.

The practical consequence: **the payment system is the access-control system.**
If a payment is recorded wrongly, somebody either loses access they paid for or
gains access they did not.

---

## 5. How money comes in

### The mechanics

Payment is card-only, through Stripe's hosted Checkout. The platform never sees
a card number. Apple Pay, Link, bank debits and every other method are switched
off deliberately.

The sequence is the same for both products:

1. The parent chooses what they are buying.
2. The server creates an **invoice** recording the intent — who is paying, for
   whom, what for, and which specific hours if any.
3. The parent is sent to Stripe's hosted page.
4. Stripe takes the money.
5. **A verified event from Stripe is what grants access**, not the parent
   returning to the site. A customer who pays and closes the tab has still paid.

Fulfilment is idempotent and runs from two places — Stripe's webhook and the
return redirect — because either can be first and either can fail.

### Who the customer is paying

**The parent is paying Yakal.** The charge lands on Yakal's own Stripe account.
Yakal is the merchant of record. Tutors and counsellors are paid afterwards out
of that balance.

This is the "separate charges and transfers" arrangement. It has a consequence
worth flagging to anyone advising: **a payout requires Yakal to be holding
enough available balance at that moment.** The transfers are not tied back to
the original charge, so money arriving and money leaving are only loosely
coupled.

### What an administrator can currently control

- The price of a course, per session
- The tutor's payout for that course, per session
- The total price of a tier
- The number of monthly instalments for a tier, from one to twenty-four

That is the entire pricing surface.

### What an administrator cannot control

- Any notion of a named payment mode
- A deposit followed by instalments
- An open-ended recurring subscription
- A platform commission expressed as a percentage
- Stripe's processing fees, or who absorbs them
- Payout timing of any kind
- Refunds, cancellations, or credits

---

## 6. How money goes out

### Tutors

A tutor connects a bank account through Stripe's hosted onboarding. Stripe
collects their identity documents, tax information and bank details. **Yakal
stores none of that** — only an account identifier and whether payouts are
enabled. This is a deliberate liability decision and a good one.

Each session a parent bought carries the payout amount for that session,
recorded at the time of purchase so a later price change cannot rewrite what
somebody is owed.

Once a session is finished, either the tutor requests payment or an
administrator sends it. The money moves from Yakal's Stripe balance to the
tutor's connected account balance.

**There is an important imprecision here.** The application says the money is
"on its way to your bank". What has actually happened is a transfer into the
tutor's Stripe balance. When that reaches an actual bank account is decided by
Stripe's own payout schedule for that account, and the application does not
track it. A tutor could reasonably feel misled.

There is no batching, no schedule, and no choice between fast and slow. There is
no handling of a failed or returned bank payout.

### Counsellors

Until very recently, **counsellors were not paid through the platform at all.**
Their earnings screen showed an estimate calculated from an hourly rate on their
profile, which bore no relationship to what a family had actually paid. Money
changed hands outside the system.

Work now exists, not yet released, to pay them a percentage of each tier
payment. An administrator sets a percentage on the tier; each time a family's
payment arrives, the counsellor's share of that payment is recorded as owed.

Two design decisions in that work are worth examining:

- **A percentage rather than a fixed amount**, so it cannot drift out of step
  when a tier is repriced.
- **A record per payment received**, rather than one record for the whole
  engagement. A ten-month plan produces ten. The alternative would have credited
  a counsellor with a year of money on the day the family made their first
  payment, before the platform had collected it.

It also deliberately does **not** check whether sessions took place before
paying. The reasoning: a tier buys availability and essay turnaround, not a
fixed number of meetings, so a quiet month still cost the counsellor reserved
time. Whether that is the right call is a fair question for review.

---

## 7. What state this is all in

### Solid

- Taking a card payment and granting access from a verified Stripe event
- Recording what somebody is owed at the moment of purchase, so later price
  changes do not rewrite history
- Keeping all sensitive identity and banking data inside Stripe
- Tutor onboarding through Stripe's hosted flow

### Recently fixed, worth knowing about

Until a few days ago **the browser told the server what to charge.** The price
of a tutoring purchase was calculated in the customer's own browser and accepted
by the server after nothing more than a range check. A customer who edited one
number paid that number. The same request also chose who received the tutor
payout, and the payout was a hardcoded seventy per cent that ignored the figure
administrators had been carefully typing in.

This is fixed but **not yet released to the live site**.

### Fragile or missing

- **Connected-account events.** Stripe sends events about connected accounts to
  a separate destination with its own signing secret. The application reads only
  one secret. Tutor onboarding status may therefore not update reliably without
  someone pressing refresh.
- **No refunds, disputes, chargebacks, reversals or negative balances** are
  handled anywhere.
- **No reconciliation.** Nothing compares what Stripe says was collected against
  what the application believes.
- **Test mode.** The live deployment is running on Stripe test keys.
- **Currency mismatch.** Prices are in US dollars. Tutor rates on profiles are
  often recorded in Ethiopian birr. Connected accounts are created as United
  States individuals regardless of where the person actually is.

---

## 8. The open questions

These are the things worth advice on. They are listed in the order they seem to
matter.

### Can Ethiopian tutors actually be paid this way?

The platform creates Stripe connected accounts as **United States individuals**,
because that is what the code says, not because anyone verified it. The tutors
are in Ethiopia. Stripe's supported countries for receiving payouts is a hard
constraint, not a configuration detail, and if Ethiopia is not on that list then
the entire tutor payout design rests on something that cannot work.

This may be the single most important question in this document. Everything
below assumes it has an answer.

### What payment shapes does the business actually need?

The current answer is: prepaid blocks of hours, and a fixed total split over one
to twenty-four months. The business has asked about deposits followed by
instalments, open-ended monthly subscriptions, and paying per hour as hours are
scheduled. None of those exist.

Before building any of them it would be useful to know which are genuinely
needed and which are just familiar.

### How should the platform take its margin?

Today the margin is implicit: the parent pays one number, the provider is paid a
smaller number, and the difference is the platform's. There is no percentage
anywhere, no application fee, and no record of what Stripe's own processing fee
cost or who absorbed it.

A percentage would be easier to reason about and easier to change. It would also
make the platform's economics visible for the first time.

### When should providers be paid?

There is no schedule. A tutor asks and money moves, or an administrator sends
it. The business has wondered about fortnightly batches and about letting
providers choose between waiting and being paid immediately.

Worth considering: the money leaving is only loosely tied to the money arriving,
so a payout schedule is also a cash-flow decision, not only a convenience.

### Who carries the risk?

Under the new Stripe account model the platform has had to state this
explicitly for the first time: **Yakal pays Stripe's fees, and Yakal carries any
negative balance.** That was implicitly true before; it is now written down.

Whether that is the right allocation, and what happens the first time a family
charges back a months-long counselling engagement, is unexamined.

### Should provider payment depend on delivery?

Tutors are paid per session, so delivery is already the trigger. Counsellors, in
the unreleased work, are paid per payment received regardless of activity.

Those are two different philosophies living in one system. It may be right —
they are two different products — but it is worth deciding on purpose.

---

## 9. Context an adviser should hold

- **The customers are Ethiopian families paying in US dollars.** Card penetration
  and cross-border card acceptance are real constraints and are not addressed
  anywhere in the current design.
- **The providers are Ethiopian contractors.** How they actually receive money is
  the open question above.
- **The company is small.** Advice that assumes a finance function or a
  dedicated payments engineer will not land.
- **The access rule is the payment rule.** Anything that changes how payment is
  recorded changes who can use the product.
- **Nothing here is at scale.** There is time to change the model. There will not
  be later.

---

## 10. A short glossary

| Term | Meaning |
| --- | --- |
| Course | A tutoring subject, priced per one-hour session, taught by one tutor |
| Tier | An admissions counselling package, priced as a total, collected over one to twenty-four months |
| Enrolment | The record that a student has been bought a course |
| Plan | The record that a student has been bought a tier |
| Invoice | Yakal's own record of an intended or completed purchase, distinct from a Stripe invoice |
| Payout | Money owed to a tutor or counsellor |
| Connected account | A provider's Stripe account, holding their bank and identity details |
| Entitlement | The derived answer to "may this student use this service", computed from purchases alone |
