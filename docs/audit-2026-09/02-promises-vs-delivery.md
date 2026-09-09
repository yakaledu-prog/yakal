# Every tier line, against what the software does

Taken from `admissions_tiers.features` as seeded, checked one line at a time.
"Blocked" means the code exists and works but a real family cannot reach it
today.

## Essential, $120 a month

| Promised | Status | Notes |
| --- | --- | --- |
| Monthly 1-on-1 advising (60 min) | Blocked | `sessions_per_month = 1` is enforced properly by `book_advising_session`. No counsellor has published availability, so the dialog opens onto "This tutor has not published any hours yet." |
| Personalized college-list development | Delivered | `college_list_items`, the My list page, and a real college dataset behind it. |
| Admissions timeline and planning | Partly | A static generic roadmap. Correct, useful, but identical for every student, so "personalized" is doing work the software is not. |
| Personal statement plus up to 3 edit rounds | Delivered | `ps_rounds_limit`, `essays.rounds_used`, kept in step by the `sync_essay_rounds` trigger. |
| Review of up to 5 supplemental essays | Delivered | Counted as distinct essays reviewed at least once, which is the right unit. |
| Email support and all group workshops | **Not delivered** | "Workshop" appears nowhere in the codebase except this sentence. |

## Premier, $250 a month

| Promised | Status | Notes |
| --- | --- | --- |
| Two advising sessions per month | Blocked | Same availability wall. |
| Tailored admissions strategy | Partly | Happens inside advising, so it stands or falls with that. |
| Unlimited email support | Delivered | Messaging works and is not metered. |
| Up to 6 personal-statement rounds | Delivered | |
| Review of up to 12 supplemental essays | Delivered | |
| Interview 101 and one mock with feedback | **Not delivered** | See below. This is the sharpest gap. |
| Priority scheduling and former-officer Q&A | **Not delivered** | Neither concept exists. There is no priority in the booking function and no events feature. |

## Elite, $450 a month

| Promised | Status | Notes |
| --- | --- | --- |
| Weekly 1-on-1 advising | Blocked | `sessions_per_month = 4`. |
| Unlimited strategy meetings and essay editing | Delivered | Null limits are read as no ceiling throughout. |
| Every application reviewed pre-submission | **Not delivered** | There is no pre-submission review state, no queue, and nothing that could evidence it happened. |
| Multiple mock interviews | **Not delivered** | |
| Scholarship and financial-aid coaching | **Not delivered** | Nothing on aid strategy anywhere in the product. |
| Waitlist, appeal and post-admission support | **Not delivered** | The only "waitlist" in the codebase is a college decision status. |

**Elite delivers two of its six advertised lines.** It is the most expensive
tier and the least backed by software. If one thing here goes to a lawyer, it
is this row.

## The mock interview gap, in detail

This one is unusual and worth understanding, because it is nearly built.

- `sessions.kind` accepts `'mock_interview'` and always has.
- `admissions_tiers.mock_interviews_limit` exists and is seeded: 0 for
  Essential, 1 for Premier, unlimited for Elite.
- `getAdmissionsUsage` counts completed mock interviews and shows the meter,
  correctly hiding it for tiers that include none.
- The admin tier editor lets you set the number.
- The AI assistant quotes the allowance to prospective customers.

And nothing in the entire codebase can create one. `book_advising_session` is
the only path to a counselling session and it hardcodes `'advising'`:

```sql
VALUES (
  p_student, v_plan.counselor_id, NULL, 'advising', 'College advising',
  ...
```

So a Premier family sees "Mock interviews 0 of 1" on their plan for ten months
and there is no button anywhere that could ever move it. The meter is honest and
the product is not.

This is a small fix. The booking function needs a `p_kind` argument checked
against `mock_interviews_limit` the way advising is checked against
`sessions_per_month`, and the booking dialog needs to know which it is asking
for. Roughly a day, including the check that pins it.

## A mislabel worth fixing today

On the counsellor's essay queue every row reads like this:

```
MIT, what you build for fun
Amen Worku - Massachusetts Institute of Technology - 200 words
0 of 5 rounds
```

That 5 is `supp_essays_limit`, the number of supplemental essays the tier
covers. It is not a number of rounds, and rounds on a supplement are not capped
at all. The tooltip on the same row gets it right and says "Essential includes 5
supplemental essays".

A counsellor reading the visible label will believe they have five editing
rounds for this one essay. They have a budget of five essays across the whole
plan. That misreading costs money in both directions: work given away, or a
student refused a round they were entitled to.

`src/pages/counselor/CounselorEssays.tsx:371`.

## What to do about the undeliverable lines

Three of these cannot be fixed with software in any reasonable time, because
they are services rather than features: group workshops, former-officer Q&A, and
scholarship coaching. There are two honest options and one dishonest one.

1. **Deliver them off-platform and record them.** A workshop is a Zoom call and
   a calendar invite. A former-officer Q&A is a person and an hour. These are
   real things Yakal could do; they just need somewhere in the product to be
   scheduled and evidenced, or nobody can prove they happened when a parent asks.
2. **Rewrite the tier copy to describe what exists.** Cheapest, honest,
   available today, and the tier editor already makes the feature list editable
   by an admin, so it needs no deploy.
3. Leave it. This is the one to avoid. Every one of these lines is a written
   promise attached to a recurring charge.

Option 2 before launch, option 1 as the roadmap. They are not in conflict.
