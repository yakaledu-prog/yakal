# Yakal Education Services

<!-- Codex and other agents read AGENTS.md; Claude Code reads CLAUDE.md. The two
     are kept identical on purpose, so guidance never depends on which tool
     somebody opened the repo with. Edit both, or neither. -->

Tutoring and college-admissions platform. React + TypeScript + Vite on the
front, Supabase for everything stateful, a handful of serverless functions for
the things that need a secret.

**Read `docs/architecture/README.md` first.** This file is the short version;
that folder is the real one.

---

## Getting it running

```
npm install
npm run db:start      # local Supabase in Docker
npm run db:reset      # migrations + seed data
npm run dev           # vite on 5173, api on 3001
```

Sign in with any seeded account and the password `demo123`. Supabase Studio is
on `54323`, outgoing mail is caught by Mailpit on `54324`.

Development runs against the **local** Supabase by default, so ordinary work
never touches the hosted project.

---

## Before you push

```
npm run check         # typecheck, lint, and the fast checks. Before every push
npm run preflight     # eslint, then tsc for src and api, then vite build
```

There is no pre-push hook. It ran `npm run check` on every push, which cost
twenty seconds each time and got bypassed with `--no-verify` often enough that
it was protecting nothing. Run it yourself before anything that matters.

There are 56 pre-existing eslint warnings and **zero errors**. If your change
adds an error, or a 57th warning, it is yours.

Most of them are `react-hooks/set-state-in-effect` from the React Compiler
rules, which are stylistic here rather than broken. Two categories are worth
reading properly when you see them, because they usually are real:
`static-components` (a component defined during render is a new type each
render, so React remounts its whole subtree and loses its state) and `refs`.

`scripts/verify/` holds 31 checks. They are not unit tests: each one pins a bug
that already happened. Read the comment at the top of one before deciding it is
redundant.

**Run them individually.** Roughly half drive a real browser through Playwright
and need `npm run dev` plus the Supabase containers already up, so
`npm run verify` (which runs everything) is flaky and slow, and it writes to
the local database.

```
node scripts/verify/testimonials.mjs            # RLS, needs the db only
npx tsx scripts/verify/api-esm-load.ts          # needs nothing
npx tsx scripts/verify/api-dispatch.ts          # needs nothing
npm run verify -- messaging                     # only suites matching a name
```

Anything importing from `src/` needs the Vite loader, because `import.meta.env`
does not exist under plain tsx:

```
node scripts/verify/_vite-run.mjs scripts/verify/realtime-refcount.ts
```

---

## Things that will bite you

**Imports inside `api/` need a file extension.** `package.json` is
`"type": "module"`, so the deployed functions are ESM, and `import x from
'./_utils/thing'` throws `ERR_MODULE_NOT_FOUND` in production while working
perfectly here. `tsc` and `tsx` both resolve it locally; only production does
not. Write `'./_utils/thing.js'`, even from a `.ts` file.
`scripts/verify/api-esm-load.ts` catches this.

**Every top-level file in `api/` is a serverless function.** Vercel's free plan
allows twelve, so related endpoints are grouped behind one file that dispatches
on `?action=`. Files starting with `_` are not routed and hold the shared code.

**Supabase grants `anon` and `authenticated` full access to new tables.** RLS
still applies, but the grant is there, so a permissive policy added later is
the only thing standing between the public internet and that table. New tables
should `REVOKE ALL` then `GRANT` only what they need. See
`supabase/migrations/20260805000100_testimonials.sql`.

**The anon key ships in the browser bundle.** It is not a secret and is not
meant to be one. RLS is the entire security model. A policy of `USING (true)`
means the whole internet.

**Nothing server-side may carry a `VITE_` prefix.** Vite inlines those into the
bundle at build time. `VITE_SUPABASE_ANON_KEY` is fine and intended;
`VITE_STRIPE_SECRET_KEY` would publish your Stripe key to every visitor.

---

## House style

- **No em dashes, no emoji.** Plain ASCII in code, UI, commit messages.
- **Brand colours only: `#1099A1`, `#97CE9D`, `#CAA25F`.** Do not invent an
  accent. `#0d7f86` is the deep-teal hover shade already in use.
- **Never `<select>`.** Use `components/ui/Dropdown` or `SelectMenu`.
- **Prefer plain coloured text over tinted capsules** for status.
- **Do not redesign UI that was not asked about.** Change data and flow; leave
  layout alone unless the change is the point.
- Commit messages read like a developer wrote them: what changed and why, no
  ceremony.

## Comments

Explain **why**, not what. The codebase leans on this: most non-obvious
decisions carry a comment saying what was tried before and why it failed.
Preserve them. If you change the code they describe, update them; if you delete
the reason, the next person repeats the mistake.

---

## Working with more than one assistant

When Codex, Claude, or another assistant share this repo, the coordination rules
(branching, PRs, who integrates, what not to force-push, the models not to
regress) live in `docs/COLLABORATION.md`. The essentials:

- Branch off the latest `main`; keep PRs small and focused; stage only your files.
- Never force-push a shared branch. If it moved under you, `git fetch` and rebase on top.
- Claude is the integrator and owns merges to `main`. Contributors open PRs into
  `main` and flag any change to a shared model (access rules, RLS, billing, the
  invite flow) rather than deciding it alone.
- Access follows payment, not a manual toggle; the invitation is the family
  relationship, not a purchase. Do not regress either.
- Run `npm run check` before every push.
