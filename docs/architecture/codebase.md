# Where things live

```
api/                serverless functions. See api.md
  _handlers/        the real handlers, one per action
  _utils/           shared: supabase, billing, email, zoom, fulfilment
src/
  app/Router.tsx    every route, and the role guard
  pages/            one folder per role, plus shared and public pages
  components/       ui/ is generic, the rest is by feature
  services/         every database call in the app lives here
  contexts/         auth, breadcrumbs, topbar actions
  hooks/            useMasterDetail, usePresence, useNavBadges
  lib/              supabase client, notification templates, theme
  utils/            small pure helpers
supabase/migrations/  the schema. The only source of truth for it
scripts/
  verify/           one script per bug that already happened
  seed/             demo data
docs/               operational guides, and architecture/
data/colleges/      the college catalog and the Python that builds it
```

---

## The rules worth knowing

**Components never call Supabase.** Every query lives in `src/services/`, and
pages call those. The rule is not aesthetic: it is what makes it possible to
find every reader of a table when a policy changes. If you are writing
`supabase.from(...)` inside a `.tsx` file, you are in the wrong file.

**Server state is TanStack Query, always.** Do not put fetched data in
`useState`. Defaults are set once in `src/main.tsx`: fifteen seconds of
freshness, refetch on window focus. The second one matters more than it looks -
see [gotchas.md](gotchas.md).

**Query keys are ad-hoc strings and there is no factory.** This is the weakest
part of the codebase. Writes invalidate by hand, so a write that invalidates
`['courses']` while a page reads `['admin-courses']` leaves stale data on
screen with nothing to catch it. When adding a query, grep for the key first
and reuse an existing one if the shape matches.

**Roles get their own page folder and their own layout.** `TutorLayout` and the
four beside it each build a nav array and hand it to `DashboardLayout`, which
owns the chrome: sidebar, breadcrumbs, command palette, notification badges.
Adding a page means a route in `Router.tsx` and an entry in one layout.

**`useMasterDetail`** turns a list-beside-record page into list-then-record on a
phone. Ten pages use it. Reach for it before hand-rolling responsive behaviour
for a two-pane screen.

## Naming and imports

`@/` maps to `src/`. Relative imports inside `src/` are fine for near
neighbours; anything crossing a folder should use `@/`.

**Inside `api/` it is different**: relative imports only, and they must carry a
`.js` extension even though the file is `.ts`. That is not a style choice, it
is the difference between working and not working in production.
[gotchas.md](gotchas.md) explains why.

## Assets

Images that the build should hash go in `src/assets/`. Files that need a stable
URL - anything a database row points at - go in `public/`, which is served from
the site root. Testimonial photos are the example: a row holding
`/testimonials/david.webp` cannot point at a bundled asset, because the bundler
renames it.
