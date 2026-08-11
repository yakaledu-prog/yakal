# Review: `feature/child-invite-links`

Read against `notes/The cleanest model is.txt`. Analysis only, nothing changed.

Seven commits, `895afb1` through `5225ebe`. The last three are a reversal of
the first four, and that matters for reading the PR.

---

## The headline

**The code is in better shape than the PR description says.** The description
documents the design as of commit `895afb1`, which the last three commits
deliberately replaced. Anyone reviewing against the description will look for
behaviour that was removed on purpose.

The model actually shipped is the one the notes argue for, and it is the right
one:

> A payment creates access only for the child, service, and billing period
> named in the purchase.

**Merge blocker: none in the code. The description needs rewriting before
anyone reviews it.**

---

## What the description says vs what the branch does

| Description says | Branch actually does |
| --- | --- |
| Signing up "linked **+ granted the chosen services**" via `claim_child_invites` | `20260808000100` redefines that trigger. It links only. No service grant. |
| Invites are "scoped by service" | The `services` column still exists and is still collected, but **nothing acts on it**. Both grant paths ignore it. |
| "a tutoring-only invite leaves College locked, as intended" | Untrue now. Both are locked until payment, whatever the invite said. |
| Access enforced by "existing `child_services` RLS + the student layout's gating" | `child_services` is out of the access rule entirely. Gating reads `v_student_entitlements`. |

The `Verification` section describes tests for the old model
("tutoring-only invite grants only tutoring"). `scripts/verify/service-entitlements.mjs`
now asserts the opposite: that a permission row without payment opens nothing.

---

## The model as built, and why it is right

Three writers used to set `child_services.is_active`, meaning two different
things:

- `fulfil.ts` on a paid admissions invoice, meaning *paid for*
- a parent toggling by hand, meaning *I allow this*
- an invite, meaning *whatever was ticked when inviting*

One boolean answering both questions, with a hand-set value able to contradict
the billing record. And **nothing anywhere ever wrote `"tutoring"`**, so buying
a course granted nothing at all: that switch could only be flipped by hand.

The split now:

- **Entitlement** is derived, never stored. `v_student_entitlements` unions
  active `enrolments` (tutoring) and active `admissions_plans` (admissions),
  both written only by the Stripe webhook.
- **Permission** is gone from the access rule. `setChildService` was removed.
  `child_services` survives as an admin/support record only.

This matches the notes exactly: *"A child's service access should be controlled
by a server-side entitlement, not by manually editable checkmarks."*

## Security

Reads well. Worth confirming rather than assuming:

- The invite table is never readable directly. Both paths go through
  `SECURITY DEFINER` functions.
- `get_child_invite` is callable signed out, which it must be, and returns only
  email, services, parent first name and a validity reason. No parent id, no
  student id, no invite id.
- `accept_child_invite` requires a signed-in **student whose email matches the
  invited address**. A stolen token cannot attach a stranger.
- Expiry (14 days), cancellation and already-used are distinct refusals.
- `FOR UPDATE` on the invite row, and the accept path is idempotent with the
  signup trigger, so the two doors cannot double-apply.

One thing to weigh, not a defect: `get_child_invite` confirms **a valid token
maps to a specific email address**. Tokens are `gen_random_uuid()`-grade, so
this is not brute-forceable, but it is an unauthenticated oracle. Acceptable;
worth being a deliberate decision rather than an accident.

---

## The real gap against the notes

The notes' headline journey is:

> Add child → Send invitation → Choose "Add a service" → Select tier → Review
> child + price → **Pay** → **Service reserved** → Child accepts → Service
> dashboard becomes available

**This branch cannot do that.** `getLinkedChildren` returns only children with
an *active* `parent_student_links` row, and both `enrolments.student_id` and
`admissions_plans.student_id` need a real student row. A pending invite has no
student id, because the account does not exist yet.

So the parent must wait for the child to accept before they can buy anything.
The notes' own recommendation is the opposite:

> This lets the parent purchase services without waiting for the child to
> accept the invitation.

And the state the notes name:

> Paid + invitation pending: service is reserved and shown as "Paid — waiting
> for child."

is **not representable** in the current schema. There is nowhere to attach a
purchase that has no student.

This is the one substantial thing the branch does not deliver, and it is
schema-shaped rather than a missing screen. Options, roughly in order of cost:

1. **Accept it.** Say plainly in the UI that a service can be added once the
   child has joined. Cheapest, and honest.
2. **Let a purchase name an invite instead of a student.** Add a nullable
   `invite_id` beside `student_id` on `enrolments` and `admissions_plans`, and
   have the accept path adopt the pending rows. Matches the notes; a real
   migration and a real reconciliation path, including refunds for an invite
   that is never accepted.
3. **Create the student row at invite time**, unclaimed, and let signup adopt
   it. Keeps purchases simple and makes signup, auth and deletion harder.

I would not build 2 or 3 on this branch. It is worth doing separately, with the
refund case thought through, and this branch is coherent without it.

---

## Doc items done, and not

Done: separate add-child from service purchase, plan summaries instead of bare
ticks ("Premier - Active"), the child named at admissions checkout, "Withdraw"
renamed to "Cancel invitation", email-format validation before an invite is
created, resend, copy link.

Not done:

- **Status vocabulary.** The notes ask for explicit states: *Payment required,
  Payment processing, Past due, Cancels on September 1, Expired, Suspended*.
  The row shows Active or "Add". A subscription past due currently reads
  exactly like one in good standing until the webhook flips `status`, at which
  point access simply vanishes with no explanation on the page.
- **Invitation expiry is not shown.** It is enforced at 14 days and never
  displayed, so a parent cannot tell a fresh invite from one about to lapse.
- **Tutoring has no plan summary.** Admissions names the tier; tutoring says
  only "Active", not which course or how many sessions remain.
- **No cart.** Buying two services means two checkouts.
- **Per-child billing line items** are not addressed. Worth checking against
  Stripe before promising sibling-level invoices.

---

## Smaller notes

- The `services` column on `parent_child_invites` is now vestigial: collected,
  stored, read into types, and acted on nowhere. Either remove it or write down
  why it is kept, or the next person will assume it works.
- `docs/PRODUCTION_UNMOCK_CHECKLIST.md` is not updated, though this branch
  fixes a genuine mock: the parent could tick a service on and it granted real
  access with no payment.
- The description warns of a merge overlap with the password-reset branch on
  `AuthPage.tsx` and `Router.tsx`. Password reset has since merged, so that
  overlap is now real and needs resolving on this branch rather than at merge
  time.
- `scripts/verify/service-entitlements.mjs` asserts against named seeded
  accounts rather than hunting for a suitable student, which is the right way
  round: the fixture contract lives in `scripts/seed/data.ts`.

---

## Recommendation

Merge, after two things:

1. **Rewrite the PR description.** It describes a design the branch removed.
   This is the only thing that would actually mislead a reviewer.
2. **Decide about `invites.services`.** Vestigial fields that look load-bearing
   cause real bugs later.

Then treat "buy for a pending child" and the status vocabulary as their own
piece of work. The access model here is the hard part and it is right.
