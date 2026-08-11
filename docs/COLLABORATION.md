# Working on Yakal with more than one assistant

This is the coordination guide for when more than one AI assistant (Claude,
Codex, others) works this repository. It does not repeat the house rules or the
setup steps: those live in `CLAUDE.md` and `AGENTS.md` (kept identical on
purpose) and in `docs/architecture/README.md`. Read those first. This file is
only about how two assistants cooperate without stepping on each other.

The one-line version: **branch off `main`, keep PRs small, respect the payment
and RLS models, and run `npm run check` before you push.**

---

## Who does what

- **Claude is the integrator / main driver.** It carries the long-run context of
  this project (the auth and roles model, the payment-to-access rework, the
  admissions tiers, the invite flow, the blog and newsletter). It reviews
  incoming PRs, resolves cross-cutting conflicts, and owns merges to `main` so
  the architecture stays coherent.
- **Codex (and any other assistant) is a contributor.** Build new features,
  improve existing ones, fix bugs, write tests and docs. Deliver the work as a
  branch and a PR into `main`. Where a change touches a shared model (access
  rules, RLS, billing, the invite flow, migrations), flag it in the PR and let
  the integrator reconcile rather than deciding it alone.

This is about keeping one mind on the whole system, not gatekeeping. Small,
self-contained changes rarely need discussion; cross-cutting ones do.

---

## The workflow

1. **Branch off the latest `main`.**
   `git fetch origin && git switch -c feat/<short-name> origin/main`
   Prefix clearly: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`.
2. **Keep the change focused.** One feature or fix per branch and PR. A reviewer
   should be able to hold the whole diff in their head.
3. **Stage only your files.** `package-lock.json` is often dirty here from
   unrelated work; do not commit it unless the dependency change is yours.
4. **Open a PR into `main`** with what changed, why, and anything a reviewer
   should know. Link related PRs.
5. **Never push to a branch someone else is on, and never force-push a shared
   branch** - that erases the other assistant's commits. If a shared branch has
   moved under you, `git fetch` then rebase your work on top. (This has already
   happened here once and needed a careful rebase to unwind.)
6. **On a merge conflict in a shared model** (access rules, RLS, billing, the
   invite flow), stop and hand it to the integrator with both sides described.
   Conflicts in unrelated files are fine to resolve yourself.

### PR checklist

- [ ] `npm run check` passes locally (typecheck, lint, fast DB checks).
- [ ] The relevant `scripts/verify/*` checks pass - name which ones you ran.
- [ ] No new lint errors and no new warnings.
- [ ] Migrations are additive and re-runnable; seed updated if the feature needs data.
- [ ] No secret (`VITE_`-prefixed or otherwise) reaches the client bundle.
- [ ] Any change to a shared model is called out for the integrator.

---

## Models you must not regress

Deliberate, hard-won decisions. Changing them is an integrator-level call, not a
drive-by edit.

> Some of this (the payment-only access rework, the per-tier admissions shading)
> is landing through open PRs and may not all be on `main` yet. Check `main` and
> the open PRs for the current code shape, and build toward this target, not the
> older `child_services`-toggle path it replaces.

- **Service access follows payment, and payment alone.** A student can use a
  service when there is a paid entitlement: an active course enrolment means
  tutoring, an active admissions plan means admissions. It is derived in the
  `v_student_entitlements` view (written only by the Stripe webhook via
  `api/_utils/fulfil.ts`) and read by `getMyActiveServices`. There is **no parent
  permission toggle**; `child_services` is dormant and not part of the access
  rule. Do not reintroduce a manual on/off switch for paid services.
- **The invitation is the family relationship, not a purchase.** Accepting a
  parent invite links the accounts and lets the child sign in; it grants no paid
  access. Services are bought per child, with the child named at checkout.
- **RLS is the security model.** The anon key ships in the browser bundle and is
  not a secret. A permissive policy is the only thing between the public internet
  and a table (see the `REVOKE ALL` / `GRANT` pattern in the testimonials
  migration). `USING (true)` means the whole internet.
- **Payments go through Stripe and the invoice/fulfilment path.** The browser
  never chooses an amount; the server reads it from the row (tier, course).

---

## Migrations and seed: the usual collision points

- **Migrations are immutable once pushed.** To change a function or policy that
  already shipped, write a new migration that `CREATE OR REPLACE`s it, rather
  than editing the old file. Two new migrations merge cleanly if they touch
  different objects.
- **`scripts/seed/data.ts`** is the single source of demo data. Two edits to it
  usually merge; overlapping rows for the same person or feature need care.
- **Overlapping logic** (the same access rule, the same function, the same
  service method) is where the integrator is needed, not a plain text merge.

---

## Local-environment gotchas (learned the hard way here)

- **The local Supabase stack sometimes will not come up** ("container is not
  ready: unhealthy"), usually the analytics/vector container after many restarts
  or Docker running low. Recover with:
  ```
  npx supabase stop
  npx supabase start -x vector,logflare      # skip the flaky analytics containers
  ```
  A full Docker Desktop restart reclaims resources when even that hangs.
- **The `check.mjs` DB checks shell out to `psql`.** A Postgres client must be on
  PATH and the Supabase containers up, or those checks skip or fail. On macOS:
  `brew install libpq` and add its `bin` to PATH.

---

## Things only a human decides

Surface these, do not decide them:

- Product or UX forks with no obviously-correct answer (for example: "should a
  parent be able to hide a paid service" is a real open question here).
- Anything destructive or hard to reverse: dropping a table or column, deleting
  data, force-pushing a shared branch, widening auth or RLS.
- Secrets, keys, live payment or email configuration, and anything touching the
  hosted project rather than the local stack.

When unsure, open the PR with the question stated plainly and let the integrator
or a maintainer choose.
