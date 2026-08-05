# The data model, and who can read it

34 tables in `public`, built by 43 migrations in `supabase/migrations/`. **The
migrations are the schema.** There is no ORM and no separate schema file; if it
is not in a migration it does not exist on a fresh database.

---

## The tables, by what they are for

**People**
`profiles` (one row per account, carries `role`), `parent_student_links`,
`parent_child_invites`, `student_academics`

**Tutoring**
`courses`, `course_applications`, `enrolments`, `sessions`,
`session_attendance`, `session_ratings`, `tutor_availability`, `assignments`,
`submissions`

**Admissions**
`admissions_tiers`, `admissions_plans`, `college_list_items`,
`application_requirements`, `application_tasks`, `essays`, `essay_reviews`,
`recommendations`, `student_documents`, `college_guide_applications`

**Money**
`billing_customers`, `invoices`, `child_services`, `tutor_payouts`

**Talking**
`conversations`, `conversation_participants`, `messages`, `message_reports`,
`conversation_flags`, `notifications`

**Public site**
`blog_posts`, `testimonials`, `contact_messages`

---

## Access control is RLS, and only RLS

The browser holds the `anon` key and talks to Postgres directly through
PostgREST. That key is in the JavaScript bundle and is not a secret. **Row-level
security is the whole security model.** A table without the right policy is not
a broken feature, it is an open door.

Two helpers do most of the work:

*   `public.is_admin()` - `SECURITY DEFINER`, checks the caller's own
    `profiles.role`. Used by every admin-only policy.
*   `auth.uid()` - the signed-in user, or null.

Server-side code in `api/` uses the **service-role key**, which bypasses RLS
entirely. That key must never reach the browser, which is why nothing
server-side carries a `VITE_` prefix.

### The trap in every new table

Supabase's default privileges grant `anon` and `authenticated` **ALL** on new
tables in `public`. RLS still gates the rows, so this is not immediately
exploitable, but it means a policy added carelessly later is the only thing in
the way. New tables should revoke and re-grant explicitly:

```sql
REVOKE ALL ON public.thing FROM anon, authenticated;
GRANT SELECT ON public.thing TO anon, authenticated;
```

`20260805000100_testimonials.sql` is the worked example, and
`scripts/verify/testimonials.mjs` is how you prove it.

This was learned the hard way: an auto-updatable view meant for the marketing
page turned out to be writable by `anon`, and an anonymous PATCH renamed a
tutor.

### What is deliberately readable signed out

The marketing site has no session, so some things must be public. This is the
complete list, and it should stay short:

| Table | Policy | Why |
| --- | --- | --- |
| `blog_posts` | SELECT `true` | the blog |
| `tutor_availability` | SELECT `true` | booking widget before signup |
| `testimonials` | SELECT `published` | the landing page |
| `v_public_tutors` | view, SELECT granted | the team section |

`v_public_tutors` is a view rather than a policy on `profiles` on purpose: it
names the five columns a card draws, so opening it does not expose email,
phone and `stripe_account_id` along with the name.

### Two policies that are wrong today

Both are in `PRODUCTION_UNMOCK_CHECKLIST.md` and neither has been fixed:

*   **`profiles` has `SELECT USING (true)` for `public`.** Anyone with the anon
    key can read every user's name, email and phone. `v_public_tutors` exists
    precisely so this is not needed. This is the most serious open item in the
    repository.
*   **`blog_posts` has `Enable all access for anon` with `ALL` and
    `USING (true)`.** Unauthenticated requests can create, edit and delete
    posts.

If you are looking for a first contribution with real value, it is these two.

---

## Migrations

```
npm run db:new <name>     new migration file
npm run db:migrate        apply pending
npm run db:reset          drop, re-run everything, reseed
```

Migrations are applied in filename order and are never edited once they have
run anywhere but your own machine. Fix a mistake with another migration.

`20260731000000_baseline_remote_schema.sql` is a dump of the schema as it stood
when migrations were adopted; everything after it is a deliberate change.
