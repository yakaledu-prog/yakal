# Everything found, in the order I would do it

Grouped by whether it stops a launch. Each line names the file so it can be
picked up without rereading the audit.

---

## Blocks launch

### 1. The counsellor home page is fabricated
`src/pages/counselor/CounselorHome.tsx`

Two mock blocks under `// --- MOCK DATA INJECTION ---` override the real
queries. `mockSessions.length > 0` is always true, so real sessions can never
render. `totalStudents: 1` and `essaysInReview: 0` are hardcoded. A counsellor
with essays waiting is told there are none, and is shown two invented sessions
with a dead Zoom link.

Delete both blocks. The real queries beneath them are correct.

### 2. No counsellor can be paid
`admissions_tiers.counselor_share_percent`, `AdminTierModal.tsx:318`

Every tier has it NULL, so `counsellorShare()` returns 0 and no earning row is
ever written. Confirmed live against a real Stripe subscription.

Set the shares. Then make the software refuse to let this happen again: block
activating a tier with no share, or flag it on the tier list.

### 3. A refund is invisible everywhere afterwards
`src/services/adminService.ts:101`, the invoice list, the parent billing page

Stripe refunds correctly and `refunds` gets its row, but `invoices.status` stays
`paid` and nothing reads `refunds`. Revenue therefore overstates income by every
refund ever issued, the admin is offered a Refund button on a refunded invoice,
and the parent still sees "Paid $99.98".

Join `refunds`, show a refunded state, subtract from revenue.

### 4. The subscription price shown is not the price charged
`ParentBilling`, plan card

The plan card reads `admissions_tiers.price_cents`, but an existing subscription
bills the Stripe Price it was created with. After an admin changed Premier from
$250 to $280, the parent's page said "$280.00 a month" while Stripe will charge
$250. Lowering the price is the worse direction, because the family finds out
from their bank.

Read the amount from the subscription; fall back to the tier only when there is
no subscription.

### 5. FAFSA is shown to students who cannot file it
`src/services/requirementsService.ts:42`

`REQUIREMENTS` is a fixed list applied to every college for every student, and it
includes FAFSA. Only US citizens and eligible non-citizens may file one. Yakal's
students are international applicants, so the product currently instructs its
core customer to do something impossible, on every college.

At minimum make the row conditional. Better, add the citizenship or applicant
type that the whole product currently lacks: `profiles` has no country field, so
nothing can tell a domestic applicant from an international one.

---

## Should be fixed before taking money, but does not stop a launch

### 6. Nobody can book a mock interview
`book_advising_session`, `20260803000300_book_advising.sql`

Promised on Premier and Elite, quota defined, counted, metered on screen, quoted
by the AI assistant, and impossible to create: the booking function hardcodes
`'advising'`. See `02-promises-vs-delivery.md`.

Add a kind argument checked against `mock_interviews_limit`.

### 7. The counsellor cannot write feedback
`CounselorEssays.tsx:138`

`essay_reviews.note` exists and `reviewEssay()` accepts it. The UI never passes
one, so essays come back with no explanation. Highest value per hour of anything
in this list.

### 8. Elite delivers two of its six promises
`admissions_tiers.features`

Group workshops, former-officer Q&A, pre-submission review, scholarship coaching
and waitlist support have no implementation anywhere. The feature list is
admin-editable, so rewriting it needs no deploy. Do that before launch and build
the services after.

### 9. Two payout failures notify nobody
`api/_utils/earnings.ts:311,367`

`no connected account` and `platform balance not settled` both mean somebody is
owed money and did not get it, and both are silent. `tellAdmins` and the
`adminNotice` template already exist, used by the branch beside them.

### 10. Every counsellor has zero availability
`/counselor/calendar`

Nothing prompts a counsellor to publish hours, so the default state of a new one
blocks the family's main deliverable. Prompt on their home page; give the family
something to do at the wall besides read a sentence.

### 11. Fake social proof on the buying page
`src/pages/parent/ParentCourseCatalogDetail.tsx:28`

Every course shows "4.8, 320 reviews, 1204 students enrolled" from a hardcoded
fixture, directly beside three tutors each marked "Not yet rated".

This exact bug was already found and fixed on the admin course page, with a
comment explaining it (`AdminCourseDetail.tsx:188`). The fix was applied to the
page staff see and missed the page customers buy from.

### 12. Checkout offers the wrong currency

Stripe presented AED 381.84 for a $99.98 charge. Turn adaptive pricing off, or
pin the presentment currency deliberately.

### 13. The FERPA waiver is advice, not a gate

`ferpa_waived` exists and is never set. Waiving after inviting is an
irreversible mistake the software could prevent. See `05-recommendations.md`.

---

## Small, visible, cheap

| What | Where |
| --- | --- |
| "You have **a ap** calculus ab session coming up today" | `StudentHome` banner |
| Banner says a session is coming up today; "Your week" beside it says "Your schedule is clear" | `StudentHome` |
| Parent home shows "NEW MESSAGES 0" while the sidebar badge says 4 | `ParentHome` |
| Children's Agenda prints raw `2026-09-08` where the rest of the app says "Sep 17" | `ParentHome` |
| A counsellor is called "This tutor" | `AvailabilityPicker.tsx:149`, `ContactInfoPanel.tsx:128` |
| "0 of 5 rounds" is the essay quota, not a round count | `CounselorEssays.tsx:371` |
| Past sessions headed "Been and gone", which does not match the tone anywhere else | `StudentAdvising` |
| Change-plan dialog leaves Confirm enabled while saying the change is impossible | plan change dialog |
| Availability grid shows three different empties: "Off", "-", "No slots" | `AvailabilityPicker` |
| Proration preview says $130.00; Stripe charges $129.99 | plan change dialog |
| Requirements are tinted capsules throughout, against the house rule preferring plain coloured text | `RequirementsCards` |
| A Google Doc that cannot be shared fails silently | `Create doc`, Drive handler |
| Abandoned checkouts sit in the admin's "OUTSTANDING" for 7 days | `voidStaleInvoices` |

---

## Worth a decision rather than a fix

- **Pricing stays monthly.** Reasoning and the numbers in `11-pricing-model.md`.
  The one thing to add before launch is copy saying the year is about seven
  months, so February does not read as a surprise.
- **Discounts are not price changes**, and should live in their own admin tab
  rather than on the tier form. `12-discounts.md`. Step one is
  `allow_promotion_codes: true`.
- **The international pathway is the moat.** FAFSA, English testing, and the
  entire F-1 visa process. `04-essays.md` closing section and
  `01-how-us-admissions-works.md`. Nothing else in this product is hard for a
  competitor to copy.
