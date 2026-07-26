# Admissions Flow Analysis (planning, no implementation)

Based on a live walkthrough of https://eyasug.github.io/yakal-portal/ logged in as all five
demo accounts: Almaz T. (Administrator), Tigist Worku (Parent), Amen Worku (Student),
Bethlehem A. (Tutor), Hana Girma (Counselor).

---

## 1. What is actually built today

### Navigation per role (from the shipped bundle)

| Role | Views |
|---|---|
| Student | Home, Sessions, Diagnostic, College, My List, My App, Messages |
| Parent | Home, Children, College, Tracker, Messages, Billing |
| Tutor | Today, Students, Diagnostic, Earnings, Messages |
| Counselor | Home, Students, College Lists, Tracker, College, Messages |
| Admin | Home, Students, Tutors, Diagnostic, College Lists, Tracker, Messages, Trust |

### The four admissions surfaces

**`college` (College roadmap).** Static marketing content. Grade-by-grade timeline
(Sophomore / Junior / Senior) with fall/winter/spring/summer buckets, an SAT vs ACT testing
plan, and 10 external resource links (Common App, FAFSA, CSS Profile, BigFuture, Bluebook,
ACT, Khan Academy, NACAC waivers, College Essay Guy). Identical bytes for every role and
every grade. It is a brochure, not a plan.

**`clist` (College List).** Schools grouped Dream / Reach, Target / Match, Safety. Each card
shows deadline type + date, avg GPA/SAT, sticker price, supplemental essay count. Has a
Compare tab and Export CSV. Below it, a "Core / personal essays" block (Common App personal
statement, activities descriptions) storing a status plus an external doc link.

**`sadm` (Application Tracker).** Per school, an 8-item checklist: Application, Essays, Recs
requested, Recs received, Transcript, Test scores, FAFSA, CSS Profile. Plus decision buttons
(Accepted / Waitlisted / Denied / Enrolled). Above it an Academics block (unweighted GPA,
weighted GPA, class rank, SAT total/EBRW/Math, ACT composite, other tests, transcript link,
Drive folder link). Below it: essays list, to-do list, recommenders list (name, role, status,
due date, Drive letter link).

**`msg` (Messages).** One shared thread surface across roles.

### Storage model

Yakal stores links, not files. Confirmed in the UI copy: "Paste a link to where you write the
essay so you and your counselor can open and review the same draft. We never store the essay
text." and "Documents stay in your Drive, Yakal only keeps the link." This matches the V1
decision in `flow_document.md`.

### Funnel already sketched

The admin Home shows: Leads captured from free diagnostics, New leads, Consults, Converted,
Admissions leads. So the intended motion is already free diagnostic to consult to paid tier.
The public site sells three tiers (Essential / Premier / Elite) and routes to "request a quote
and a counselor will match you to the right tier."

---

## 2. The core problem: student and counselor have the same portal

The counselor's two work surfaces (`clist`, `sadm`) are byte-identical to the student's
(`My List`, `My App`). The only difference is that the counselor gets a student picker
dropdown at the top. Same fields, same edit rights, same buttons.

That is why the roles are unclear. Nothing in the product says who does what. Two people are
handed the same form and told to fill it in. In practice that means either both edit and
conflict, or neither edits and it rots.

It also diverges from the written spec. `docs/flow_document.md` says:

> College Guide Flow: Student submits -> Counselor reviews -> status flows back to Student
> (visible to linked Parent).

There is no submit, no review, and no status handoff anywhere in the shipped portal.

### Other gaps found while clicking

- **Counselor has no calendar and no sessions view.** The tutor has "Today" plus "Earnings".
  The counselor has neither. Every tier sells advising sessions (monthly / two per month /
  weekly), and the portal cannot show that a single one happened.
- **Counselor has no earnings or payout view.** Tutors do.
- **No session notes artifact.** The spec called for a WYSIWYG note editor on the counselor
  side. It is not there. After a 60 minute advising call, nothing lands in the portal.
- **No essay rounds.** Tiers sell "up to 3 edit rounds", "up to 6 personal statement rounds",
  "review of up to 12 supplemental essays". An essay in the portal is a link plus a status
  string. There is no way to count a round, so the thing being sold cannot be measured.
- **No tier on the student record.** The portal does not know whether Amen is Essential or
  Elite. Nothing can be gated, metered, or upsold.
- **40 manual checkboxes per student.** 8 requirements times 5 schools, none derived from data
  the portal already holds. Nobody will maintain that by hand.
- **Seed data shows the manual-entry failure mode.** Towson University appears twice with
  different deadlines (2026-12-01 and 2026-07-30), different GPAs (3.5 and 3.4), different
  sticker prices ($10,078 and $20,000), different supplement counts (0 and 3). That is what
  free-text school entry produces at scale.
- **Diagnostic is tutoring-only** (Math, ELA, Physics, Pre-Calc, Calculus, Chemistry). There is
  no admissions-side diagnostic, which is the natural lead magnet for the admissions product.
- **Parent `Tracker` resolves to the same `sadm` view** as the counselor's, fully editable.
  Parent editing the student's application checklist is probably not intended.
- Minor: parent nav ids `pcollege` and `ptrack` render "View not found" when hit directly;
  the working ids are `college` and `sadm`.

---

## 3. Roles as they should be

One rule that resolves everything:

> **Objective facts belong to the system. Subjective content belongs to the student.
> Judgment belongs to the counselor. Money and oversight belong to the parent.**

### System owns (nobody types this)

Every public, verifiable fact about a school: name, deadlines, sticker price, admitted
GPA/SAT/ACT ranges, admit rate, student-faculty ratio, aid percentages, admissions contact,
supplement count and prompts, tour link.

### Student owns (their effort, their words)

- Proposing schools they are interested in
- The "why this school" note, major of interest, campus visit impressions
- Writing every draft
- Physically asking teachers for letters
- Submitting the actual applications and forms
- Marking done only the steps only they can perform

### Counselor owns (judgment, and the thing being paid for)

- **Approving the list.** Student proposes, counselor confirms or reclassifies
  Dream / Target / Safety. A student calling Hopkins a "target" is exactly the error you are
  paid to catch. This single approval step is what makes the two roles distinct.
- **Strategy calls:** ED versus EA versus RD, where to spend the ED bullet, how many schools,
  list balance, testing plan, whether to go test-optional.
- **Positioning and narrative:** what story the application tells.
- **Essay feedback rounds** on the student's drafts.
- **Recommender strategy:** who to ask, for which school, by when.
- **Accountability:** owning the at-risk queue and unblocking.

### Parent owns

Billing, FAFSA/CSS financial inputs, and read-only visibility across everything.

### Concrete state machine to add

Give each school on the list a lifecycle so the handoff is visible:

```
proposed (student)
  -> reviewed (counselor sets or confirms category, adds rationale)
    -> active (agreed, appears in tracker)
      -> applied (student submits)
        -> decided (accepted / waitlisted / denied / enrolled)
```

Same idea for essays:

```
drafting (student)
  -> submitted for review (student)
    -> feedback given (counselor, this increments the round counter)
      -> revising (student)
        -> approved (counselor)
```

Now both people can open the portal and immediately see whose move it is. That alone answers
"what am I supposed to do here."

---

## 4. Automation and prefill

### 4a. The college list should be a catalog, not a text box

The Add-a-school form currently asks for 14 fields, all typed by hand:

| Field | Who should supply it |
|---|---|
| School name | Catalog autocomplete |
| Category (Dream/Target/Safety) | Suggested by system, confirmed by counselor |
| Status | Derived from lifecycle |
| Deadline type + date | Catalog |
| Admissions contact email | Catalog |
| Supplemental essays (#) | Catalog |
| Sticker price / yr | Catalog |
| Avg GPA / SAT admitted | Catalog |
| Class size / ratio | Catalog |
| % on aid / merit aid | Catalog |
| Program ranking | Catalog where available, else manual |
| Tours / virtual tour | Catalog |
| Is your major offered / program to apply to | Student |
| Notes | Student and counselor |

Ten of fourteen are public data. **Recommendation: catalog-first with a manual escape hatch.**
The student types "Johns Hop", picks from autocomplete, and gets ten fields filled and marked
as verified. They only fill in the two that are genuinely theirs. A "add a custom school"
path stays for foreign universities and tiny colleges.

This also kills the duplicate-Towson problem, because a school becomes a reference to a
catalog row rather than free text.

**Data sources.**
- **College Scorecard API** (api.data.gov, free, US Dept of Education): roughly 6,000
  institutions with cost of attendance, SAT/ACT 25th-75th percentiles, admit rate, size,
  aid percentages. This is the backbone.
- **IPEDS**: student-faculty ratio, admissions office contact.
- **Deadlines and supplement counts** change every cycle and are not in a clean free API.
  These need one curation pass per year. Covering the top 300 schools by application volume
  will cover the overwhelming majority of what Yakal families actually apply to. Everything
  outside that falls back to manual with a "not verified" badge.
- GPA is not in Scorecard. Either show SAT/ACT ranges only, or source admitted GPA from
  Common Data Set filings during the same annual curation pass.

### 4b. Derive the checklist instead of asking for it

Of the 8 per-school requirements, 5 can be computed from data the portal already stores:

- Test scores: tick when the Academics block has an SAT or ACT
- Transcript: tick when the transcript link is present
- Essays: tick when every supplement attached to that school is approved
- Recs requested: tick when N recommenders exist with status requested
- Recs received: tick when those recommenders have letter links
- FAFSA / CSS Profile: tick once at student level, propagate to every school
- Application: the only genuinely manual one (student confirms submission)

That turns 40 manual toggles into about 2 real ones plus a set of derived indicators that are
actually trustworthy.

### 4c. Other high-value automations

- **Auto-create essay stubs.** Add JHU, and if the catalog says 1 supplement, create 1 essay
  row with the real prompt text and the school's deadline prefilled.
- **List balance check.** Compare the student's Academics block against catalog SAT/GPA
  ranges and flag "you have 2 safeties but both are actually targets for your profile." This
  is a genuine insight, it is cheap to compute, and it is an excellent sales demo.
- **Turn the static roadmap into dated tasks.** The grade-by-grade timeline already contains
  the right content. Emit it as actual dated to-dos into the student's list based on their
  grade and graduation year, instead of leaving it as a brochure everyone reads once.
- **Deadline engine.** Days-left already renders. Promote it to notifications for student and
  parent, plus a counselor-facing "at risk" queue sorted by days remaining against percent
  complete. The counselor's Home should be that queue, not four vanity stat tiles.
- **Prefill student profile once, reuse everywhere.** Name, grade, graduation year, intended
  major, GPA, test scores, transcript link. Collected in onboarding, never asked again.

### 4d. Who seeds the initial list

Counselor, live, during the kickoff call. Eight to twelve schools entered in the portal while
the family watches. It sets the standard, demonstrates the tool, and guarantees the account
is never an empty shell. After that, the student proposes additions and the counselor
approves them.

---

## 5. Monetization: what is actually being sold

### Why a counselor is worth paying for

Software can hold the data. It cannot do these:

- **Positioning.** Deciding what story a student's activities add up to.
- **The ED gamble.** One binding shot, real strategy, real consequences.
- **Essay voice.** Making a 17-year-old's draft sound like a person and not like a template.
- **Aid and merit strategy.** Building a list where a strong student is in the top decile at
  a school that pays for it. Merit differences run into the tens of thousands of dollars per
  year, which means a well-optimized list returns several times any tier fee. This is the
  single most honest and most compelling number in the pitch.
- **Accountability.** Someone whose job is to notice a missed deadline before it is missed.

### How to get students and parents to pay

Give the software away. Charge for the human.

Free tier: diagnostic, college list with the full catalog, application tracker, roadmap,
deadline reminders. That is the lead magnet, and it is already almost entirely built. It
maps directly onto the funnel the admin console is already measuring.

Paid tiers buy counselor hours, with the portal as the proof of delivery:

- **Deadline safety.** "No student in the Yakal portal has missed a deadline." Measurable,
  provable, and it targets the parent's actual fear.
- **Money.** Aid and merit optimization, with a target dollar figure named at kickoff.
- **Essays.** A named counselor, a defined number of feedback rounds, visibly logged.
- **One place.** Parents stop nagging. Everything is visible without asking.

### What has to exist for the tiers to be defensible

Right now a family pays for Elite and the portal looks the same as free. Fix that:

1. **Tier on the student record**, with entitlement metering rendered in the UI:
   "Essay rounds 4 of 6 used", "Advising sessions 1 of 2 this month". Metering makes the
   invoice defensible and creates natural upsell pressure without a sales call.
2. **Counselor sessions with agenda and notes.** Every session produces a written summary in
   the portal. That artifact is what the parent reads and what justifies renewal.
3. **Essay rounds as first-class objects**, counted against the entitlement.
4. **Counselor earnings and payout parity** with tutors, so counselors will actually log work.
5. **Gate by tier**, not by hiding data. Interview prep, scholarship coaching, and
   pre-submission review appear as locked modules on lower tiers.

Note the Trust view already flags possible off-platform contact. That leak (counselor and
family going direct) is the main threat to this model, and the fix is the same as the fix for
everything above: make the portal the place where the work visibly happens.

---

## 6. Suggested build order

1. School catalog + autocomplete prefill (biggest quality and speed win, kills manual entry)
2. Proposed / reviewed / active lifecycle on schools, so student and counselor roles separate
3. Derived checklist
4. Counselor sessions with notes, plus counselor earnings
5. Tier field and entitlement metering
6. Essay rounds as objects
7. Deadline engine and counselor at-risk queue
8. Roadmap to dated tasks
9. List balance and fit insights
