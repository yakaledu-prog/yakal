# Everything found, in the order I would do it

Grouped by whether it stops a launch. Each line names the file so it can be
picked up without rereading the audit.

**Done** marks something fixed during the audit and verified in a browser
afterwards. Everything else is still open and is either a decision or a build.

---

## Blocks launch

### 1. The counsellor home page is fabricated. DONE
`src/pages/counselor/CounselorHome.tsx`

Two mock blocks under `// --- MOCK DATA INJECTION ---` override the real
queries. `mockSessions.length > 0` is always true, so real sessions can never
render. `totalStudents: 1` and `essaysInReview: 0` are hardcoded. A counsellor
with essays waiting is told there are none, and is shown two invented sessions
with a dead Zoom link.

Both blocks deleted. The counsellor now reads 2 students, 1 essay in review and
0 upcoming sessions, which is what the database holds and what their own
Sessions page says. The student home had the same disease and the same fix:
Active Courses was the literal string "3", and the streak and grade came from
`MOCK_DASHBOARD_SUMMARY`. Streak and grade are gone rather than replaced,
because nothing supports either.

### 2. No counsellor can be paid. PART DONE, needs a decision from you
`admissions_tiers.counselor_share_percent`, `AdminTierModal.tsx:318`

Every tier has it NULL, so `counsellorShare()` returns 0 and no earning row is
ever written. Confirmed live against a real Stripe subscription.

The tier list now says so, in amber, on every active tier: "No counsellor share
set. Anyone advising on this tier earns nothing, and no earning is recorded to
settle later." So it can no longer happen silently.

**The number itself is yours.** I have not set one, because what a counsellor
keeps is a business decision, not a bug. Tutoring runs at 70 percent to the
tutor ($35.00 of $49.99). Until a share is set on each tier, counselling pays
nobody.

### 3. A refund is invisible everywhere afterwards. DONE
`src/services/adminService.ts:101`, the invoice list, the parent billing page

Stripe refunds correctly and `refunds` gets its row, but `invoices.status` stays
`paid` and nothing reads `refunds`. Revenue therefore overstates income by every
refund ever issued, the admin is offered a Refund button on a refunded invoice,
and the parent still sees "Paid $99.98".

Both sides now read the `refunds` table. The admin row shows **Refunded** with
"$99.98 back" and no longer offers a Refund button on it; revenue went from
$219.98 to the correct $120.00. The parent sees **Refunded**, "$99.98 back", and
Paid to date corrected from $219.98 to $120.00.

### 4. The subscription price shown is not the price charged. DONE
`ParentBilling`, plan card

The plan card reads `admissions_tiers.price_cents`, but an existing subscription
bills the Stripe Price it was created with. After an admin changed Premier from
$250 to $280, the parent's page said "$280.00 a month" while Stripe will charge
$250. Lowering the price is the worse direction, because the family finds out
from their bank.

`admissions_plans.billed_amount_cents` is synced from the subscription item
beside `current_period_end`. Verified against Stripe: with a live $120
subscription, moving Essential to $150 leaves the family's page reading $120,
which is what Stripe charges. The tier price stands in only for a plan nobody
has been billed for.

### 5. WITHDRAWN

This slot held a claim that FAFSA should not be shown, on the mistaken
assumption that the students were international applicants. They are not: Yakal
is a US company serving US families, and FAFSA belongs on the checklist exactly
where it is. The inference came from names in the seed data and a line of
marketing copy, neither of which is evidence of who the customer is.

Left in rather than deleted so the numbering below does not shift under anyone
who has already read this.

---

## Should be fixed before taking money, but does not stop a launch

### 6. Nobody can book a mock interview
`book_advising_session`, `20260803000300_book_advising.sql`

Promised on Premier and Elite, quota defined, counted, metered on screen, quoted
by the AI assistant, and impossible to create: the booking function hardcodes
`'advising'`. See `02-promises-vs-delivery.md`.

Add a kind argument checked against `mock_interviews_limit`.

### 7. The counsellor cannot write feedback. DONE
`CounselorEssays.tsx:138`

`essay_reviews.note` existed and `reviewEssay()` accepted it; the UI never
passed one. Send back now requires a note, Finished takes an optional one, and
both reach the student on the essay and in the email that already claimed a
counsellor had "left comments on it". `getEssayReviews` had no caller at all, so
the whole review history was written and never shown; the student now sees
"Daniel Haile - sent it back - Sep 9" with the note under it.

### 8. Elite delivers two of its six promises
`admissions_tiers.features`

Group workshops, former-officer Q&A, pre-submission review, scholarship coaching
and waitlist support have no implementation anywhere. The feature list is
admin-editable, so rewriting it needs no deploy. Do that before launch and build
the services after.

### 9. Two payout failures notify nobody. DONE
`api/_utils/earnings.ts:311,367`

`no connected account` and `platform balance not settled` both meant somebody
was owed money and did not get it, and both were silent. The payee is now told
what is waiting and that connecting a bank releases it; admins are told somebody
cannot be paid. Latched on a new `payout_blocked_notified_at`, because Supabase
Cron calls the job hourly and this would otherwise be two dozen messages a day.
Pinned by `scripts/verify/payout-blocked-notice.ts`.

### 10. Every counsellor has zero availability
`/counselor/calendar`

Nothing prompts a counsellor to publish hours, so the default state of a new one
blocks the family's main deliverable. Prompt on their home page; give the family
something to do at the wall besides read a sentence.

### 11. Fake social proof, and a wrong price, on the buying page. DONE
`src/pages/parent/ParentCourseCatalogDetail.tsx:28`

Every course shows "4.8, 320 reviews, 1204 students enrolled" from a hardcoded
fixture, directly beside three tutors each marked "Not yet rated".

This exact bug was already found and fixed on the admin course page, with a
comment explaining it (`AdminCourseDetail.tsx:188`). The fix was applied to the
page staff see and missed the page customers buy from.

Worse, and found while fixing it: the prices beside those numbers were literals
too. Every course advertised "$199.96/course" and "starting at $49.99/hr",
whatever it cost, so the $65.00 Physics course was advertised at $49.99 and
charged at $65.00. Both now come from the course. Courses are priced per session
and have no session count, so there is no course total to show and it is gone.

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
| ~~"You have **a ap** calculus ab session coming up today"~~ DONE. It was not a grammar bug: the whole banner came from `MOCK_DASHBOARD_SUMMARY` | `StudentHome` |
| ~~Banner says a session is coming up today while "Your week" says the schedule is clear~~ DONE. Same cause, and every figure on that screen now agrees with the panel beside it | `StudentHome` |
| Parent home shows "NEW MESSAGES 0" while the sidebar badge says 4 | `ParentHome` |
| Children's Agenda prints raw `2026-09-08` where the rest of the app says "Sep 17" | `ParentHome` |
| ~~A counsellor is called "This tutor"~~ DONE. The picker takes a `personLabel`, and its empty state now says what to do next | `AvailabilityPicker.tsx` |
| ~~"0 of 5 rounds" is the essay quota, not a round count~~ DONE. Rounds are capped on the personal statement and nowhere else; a supplement now reads "round 2" | `CounselorEssays.tsx` |
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
- **The record is the moat, and the end of the season is where it pays.**
  `04-essays.md` closing section. Every review is already stored with its actor,
  its note and its timestamp, and none of it has ever been shown to the family
  paying for it. Deferrals, waitlist letters and comparing aid offers all land in
  March and April, which is where the value is densest and where the product
  currently stops. It is also when a monthly plan gets cancelled.
