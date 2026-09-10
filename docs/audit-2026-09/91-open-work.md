# Open work, as of 10 September 2026

What is left after the September audit and the fixes that followed it. Written
so it can be picked up cold, without rereading the rest of this folder.

Everything here is **open**. Anything marked DONE in `90-fix-list.md` is not
repeated.

Three groups: decisions only you can make, work that is understood and just
needs building, and small things worth a tidy-up pass.

---

## 1. Decisions, not code

These are blocked on a judgement rather than on effort. Each says what happens
if it stays unanswered.

### The counsellor share

`admissions_tiers.counselor_share_percent` is null on all three tiers, so
`counsellorShare()` returns 0 and **no counselling earning row is ever written**.
The tier list now says so in amber on every active tier, so it cannot happen
silently any more, but the number itself is yours.

For reference, tutoring runs at roughly 70 percent to the tutor: $35.00 of a
$49.99 session.

**If unanswered:** counsellors work and are recorded as owed nothing.

### What Elite actually includes

Elite advertises six things and the software backs two. Group workshops,
former-officer Q&A, pre-submission review, scholarship coaching and waitlist
support have no implementation anywhere. Premier's "Interview 101 and one mock
with feedback" and "priority scheduling and former-officer Q&A" are in the same
position.

The feature list is editable by an admin, so rewriting the copy needs no deploy.
Building the services is a roadmap, not a launch blocker. Doing neither is the
option to avoid: every line is a written promise attached to a recurring charge.

**If unanswered:** you are selling six things and delivering two, in writing.

### Monthly billing, and saying the year is seven months

`11-pricing-model.md` recommends staying monthly and explains why. The one thing
worth adding before launch is copy telling a family the arc: roughly September
to March, about seven months, so February does not read as a surprise. That is
copy, not code.

### Discounts

`12-discounts.md`. Step one is `allow_promotion_codes: true`, one line. Step two
is a Discounts tab under Admissions, deliberately not on the tier form, so
running a promotion and changing the list price cannot be confused. Per-family
awards come later.

### Referrals

Worth doing, worth doing later. The thing to incentivise is a family who stays
through March, not a signup, and there is no retention data yet to price that.
It is also cleanest built on discounts, because a referral reward is a coupon
with a reason attached.

### The installed app asks for sign-in on every launch

Sessions live in `sessionStorage` on purpose: the dashboard holds billing detail
and a token that outlives the tab on a shared machine is exactly the exposure to
avoid. The consequence is that a PWA launch is a fresh context with no session,
so an installed app always opens on the login screen.

That is a real tradeoff rather than a bug. If the app is meant to feel like an
app, this is the thing to revisit, and the safer middle is a longer-lived
refresh token with the idle sign-out doing the work.

---

## 2. Understood, needs building

### Nobody can book a mock interview

Promised on Premier and Elite, the quota is defined and enforced, sittings are
counted, the meter is on screen, and the AI assistant quotes the allowance.
Nothing in the codebase can create one: `book_advising_session` hardcodes
`'advising'`.

Needs a kind argument checked against `mock_interviews_limit` the way advising
is checked against `sessions_per_month`, and the booking dialog needs to know
which it is asking for. Roughly a day including a check.

### The FERPA waiver should be a gate, not a footnote

`recommendations.ferpa_waived` exists and is never set or shown. The waiver is
signed once per application, **before** invitations go out, and an unwaived
letter is worth materially less. A student who invites three teachers and then
waives has done it in the wrong order and nothing says so.

Since it is once per application rather than per recommender, it probably
belongs beside the student's application rather than on the recommender row.
The gate is worth more than any other change on that page because it prevents a
mistake that cannot be undone.

### Counsellors are never asked to publish hours

Every counsellor in the database has zero availability, and the family hits
"This counsellor has not published any hours yet". The empty state should belong
to the counsellor, not the family: prompt them on their own home page once they
have a student.

### Diagnostics are two questions long

Every seeded test has exactly two questions. That is fine as a fixture and
useless as placement. Now that the questions live in the database and an admin
can edit them, this is content work rather than engineering.

### Onboarding offers every subject to everybody

A student in grade 11 is offered Elementary Math through Calculus, plus College
Essays, and must sit or skip twelve tests. `diagnostics.course_id` exists and is
unused, and profiles carry `grade_level`. Scoping the onboarding sitting to what
a student is actually here for is the missing piece, and it is what "the
diagnostic is per subject" should mean in practice.

### The diagnostics gate is inconsistent

A student with no plan can sit diagnostics during onboarding, but the standalone
page is locked behind `LockedOverlay` with "not part of your current plan". Both
behaviours are defensible; having both is not.

### Two payout skips now notify, one case still needs a person

`no connected account` and `platform balance not settled` both reach somebody
now. Worth deciding what an admin actually does about a stalled platform
balance, because the notification currently just says it happened.

---

## 3. Small, visible, cheap

| What | Where |
| --- | --- |
| `DEV_PREVIEW` is on in the production build. The app logs "demo logins and /preview are public" on boot | `VITE_DEV_PREVIEW`, unset before launch |
| Stripe Checkout offers AED for a USD charge, from adaptive pricing | Stripe dashboard, or pin the presentment currency |
| "1 sessions total" and "1 Total Sessions" | `StudentSessions` |
| The rating dialog puts the comment box above the stars, so you explain before you score | `RateSessionDialog` |
| The availability grid shows three different empties: "Off", "-", "No slots" | `AvailabilityPicker` |
| Proration preview says $130.00; Stripe charges $129.99 | plan change dialog |
| Abandoned checkouts sit in the admin's "OUTSTANDING" for 7 days | `voidStaleInvoices`, self-correcting |
| A counsellor's availability never shows in the messaging contact panel; the block only renders for tutors | `ContactInfoPanel` |
| A passed deadline still appears under "Upcoming Deadlines" | `CounselorHome` |
| Requirements render as tinted capsules throughout, against the house preference for plain coloured text | `RequirementsCards` |
| A Google Doc that cannot be shared fails silently, which will happen for any address that is not a Google account | Drive handler |

---

## 4. Where the value is, when there is time

From `04-essays.md`, unchanged by anything since:

**Show the family the record.** Every essay review is stored with its actor, its
timestamp and its note, rounds are counted by a trigger, and quotas are computed
from what actually happened. None of that has ever been shown to the person
paying for it. A parent who can see round 2 returned on 3 October with the
counsellor's note, and round 3 approved on the 11th, is a parent who renews.

**Own the end of the season.** Deferrals, waitlist letters, and comparing and
appealing aid offers, in March and April. That is where the value is densest,
where families most need somebody who has done it before, and where the product
currently stops. It is also exactly when a monthly plan gets cancelled.
