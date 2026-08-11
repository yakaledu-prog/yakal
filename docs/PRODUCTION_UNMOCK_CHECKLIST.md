# Production un-mock and hardening checklist

Things deliberately left mocked, relaxed or insecure to move fast during
development. **Every item here must be reviewed or reverted before a real
production launch.** Keep it up to date as new shortcuts are added.

Legend: `[ ]` still needs action before production, `[x]` handled

---

## Security

- [ ] **Dev preview routes and the developer console**, `src/config/dev.ts`.
  `DEV_PREVIEW` now reads `VITE_DEV_PREVIEW`, so it is per deployment rather
  than per commit. **It must be unset or "false" on the deployment real people
  use.** On, it publishes `/preview/*`, the `/dev` console, and the one-click
  demo logins, and those accounts use `demo123`, which is written down in this
  repository. `/dev` also refuses whenever `VERCEL_ENV=production`, which is a
  second lock on the server side, but the demo logins are client-side and have
  only this one. A red console warning fires on every load of a production
  build with it on.

- [ ] **`blog_posts` is writable by anyone with the anon key.** The baseline
  migration carries `Enable all access for anon ... USING (true)`, and the anon
  key ships in the browser bundle, so an unauthenticated request can create,
  edit and delete posts. Replace with a public `SELECT` on published rows and
  an admin-only write policy. `supabase/migrations/20260805000100_testimonials.sql`
  is the shape to copy, including the `REVOKE`, and
  `scripts/verify/testimonials.mjs` is the shape of the test.

- [x] **`profiles` is no longer readable signed out.**
  `20260805000400_profiles_not_public.sql` narrows `SELECT` to `authenticated`
  and revokes the leftover `anon` grant. Before it, an unauthenticated request
  returned every row: name, email, phone, `stripe_account_id`.
  `scripts/verify/profiles-not-public.mjs` pins it, and fails with
  "17 rows came back" against the old policy.

- [ ] **Any signed-in user can still read every profile.** The remaining half
  of the above: the policy is `USING (true)` for `authenticated`. Scoping it
  person by person (your tutors, your students, your children's tutors, anyone
  you share a conversation with) touches around ten services, so it was left
  as its own job rather than bundled into a security fix that had to ship.
  Note this overlaps the `getContacts` item below, and the two should be done
  together.

- [ ] **Notifications INSERT policy is wide open.** The
  "Authenticated users can insert notifications" policy in the baseline
  migration lets any signed-in user insert a notification for any `user_id`.
  It is there so clients can notify each other (a student books, the tutor gets
  told). Move notification creation into a `SECURITY DEFINER` RPC or a trigger
  so clients cannot forge them.

- [ ] **Demo accounts are pre-approved.** `scripts/seed/data.ts` marks the
  tutor and counselor `status: "active"`, skipping the admin approval gate, so
  the roles can be demoed without a second account. Do not seed a production
  database.

- [ ] **Demo accounts share a public password.** Everything the seeder creates
  uses `demo123`, which is written down in this repository. That is fine for a
  throwaway testing project and deliberate, but these accounts must not exist
  in a production database at all.

- [x] **Demo login buttons**, `src/pages/shared/AuthPage.tsx`. Now behind
  `DEV_PREVIEW`, so turning that flag off for production hides them along with
  `/dev` and the `/preview/*` routes. No separate step to remember.

- [ ] **Any signed-in user can list every profile.** `getContacts` in
  `src/services/messageService.ts` returns every other profile so a new chat can
  be started with anyone. Scope it to people you are actually connected to
  (your tutors, your students, your children's tutors) before launch.

## Data and correctness

- [x] **Avatar upload bucket.** Now created by
  `supabase/migrations/20260731000060_storage_avatars_bucket.sql`, so it exists
  on any database built from the migrations. Previously a loose SQL file that
  had to be remembered.

- [ ] **Chat attachments are browser only.** Images, files and voice notes in a
  conversation are object URLs held in React state (see `ChatBody`). They are
  not uploaded and disappear on reload. Only text messages persist.

- [ ] **The parent course catalog is mock data.** `MOCK_TUTORS` in
  `src/pages/parent/ParentCourseCatalogDetail.tsx` drives the tutor cards, so
  those ids are not real profiles. The chat and the booking call on that page
  are wired to the real services and will fail against a fake id.

- [ ] **Student and parent home figures are hardcoded.**
  `MOCK_DASHBOARD_SUMMARY` in `src/mock/index.ts`, served by
  `studentService.getDashboardSummary`. Needs a query joining sessions,
  assignments and submissions for the signed-in student.

- [ ] **Diagnostic results live in localStorage.**
  `src/services/diagnosticService.ts` keeps them in the browser, so they do not
  follow a student between devices and a tutor sees nothing. Needs a
  `diagnostic_results` table and a migration.

- [x] **Notification screens.** All four roles now read real notifications
  through `notificationService`, sharing one `NotificationsScreen` component.
  They previously rendered four separate hardcoded arrays, so a real
  notification was written to the database and shown to nobody.

The mock surface is deliberately concentrated: `src/mock/index.ts` is the only
module holding hardcoded application data. When it is empty, the app runs
entirely on the database.

## Google OAuth scopes

- [ ] **The service-account path asks for full Drive.**
  `api/_handlers/drive.ts` sets `SCOPES = ['https://www.googleapis.com/auth/drive']`,
  used at the `googleAuth.JWT` call in the `GOOGLE_SERVICE_ACCOUNT_JSON`
  branch. That is every file in the account, not just ours.

  It is unreachable today: production runs the refresh-token path, where the
  scope comes from the token `scripts/google-oauth-setup.mjs` minted, which is
  `drive.file`. So it does not affect the consent screen as configured.

  It becomes live the moment anyone switches to a service account, which is
  exactly what a Google Workspace plan would tempt you into. **Narrow it to
  `drive.file` before that switch, not after.** `drive.file` grants access only
  to files this app created, which is all the app ever touches.

  The cost of getting this wrong is not just over-permissioning. Full
  `auth/drive` is a **restricted** scope, not merely sensitive: Google requires
  verification *and* an annual third-party security assessment (CASA) for it,
  which is a real recurring bill. `drive.file` avoids that entirely.

- [ ] **`src/hooks/useClassroomToken.ts` is dead code with a misleading scope
  list.** Nothing imports it. The live browser flow is `CLASSROOM_SCOPES` in
  `src/services/classroomService.ts`, used by `AdminCourseModal`. The dead hook
  carries a third, different list including
  `classroom.coursework.me.readonly`, which appears nowhere else in the
  codebase. Delete it, so nobody configures a consent screen from it later.

  For reference, the three scope lists that exist today:

  | Where | Used by |
  | --- | --- |
  | `scripts/google-oauth-setup.mjs` | the server refresh token, the one that matters |
  | `classroomService.ts` `CLASSROOM_SCOPES` | admin Fetch Details popup |
  | `useClassroomToken.ts` | nothing |

## Diagnostics

- [ ] **`time_limit_minutes` is enforced nowhere.** It is stored on the
  `diagnostics` table, set on all twelve seeded tests, and read into
  `DiagnosticRow`, but no student screen ever uses it. There is no timer, and
  it is not even displayed. A student can take as long as they like, and stop
  and come back.

  The admin form used to ask for it, which promised a rule the app does not
  apply. The field is off the form until there is a timer behind it. The column
  is untouched, so implementing one later needs no migration.

  Two ways out, whichever is wanted: run a real countdown on the student side
  and submit on expiry, or drop the column. Leaving it collected but unused is
  the one option that misleads.
## Student profile (fixed 2026-08-08, kept here as the pattern)

- [x] **The three stat cards read 3, 12 and 5 for every student.** Hardcoded in
  `StudentProfile.tsx` as a `stats` array, complete with fake trend lines
  ("+1 this month", "Top 20%"). Removed rather than wired up: the same page now
  shows facts about the person, which cannot go stale.

- [x] **The whole Recent Activity list was invented.** Five hardcoded rows,
  "1-on-1 Mentorship: Algebra" and friends, identical for every account and
  dated October in a page anyone might open in August. Replaced with the shared
  `PastSessions` list reading `getStudentSessions`.

- [x] **The notifications toggle was wired to nothing.** `useState(true)`, a
  switch that animated and saved nothing, under a heading that promised
  "Marketing Alerts". Removed. If marketing preferences are wanted later they
  need a column and a writer, not a toggle.

- [x] **Eight resource links were `href="#"`.** Every card on the roadmap
  Resources tab looked and hovered like a link and did nothing. Real URLs now
  live in `src/config/collegeResources.ts`.

The lesson each of these shares: a fake value that renders correctly is
invisible in review and only shows up when a real user reads it as true. When
adding a screen, prefer an empty state over a plausible number.


## Newsletter (fixed 2026-08-09)

- [x] **The footer Subscribe form threw the address away.** It ran
  `toast.success("Thanks for joining our newsletter")` and nothing else, so
  everyone who signed up between launch and now is gone, with no record they
  ever tried. It writes to `newsletter_subscribers` now.

- [ ] **`EMAIL_FROM` is unset, so every email sends from
  `onboarding@resend.dev`.** That is Resend's shared sandbox sender and only
  delivers to the Resend account owner's own address. Transactional mail has
  the same problem, not just the newsletter. Set it to an address on
  `yakal.me`, which is verified. See `docs/EMAIL_SETUP.md`.


## Parent profile (fixed 2026-08-11)

- [x] **Recent Activity was five invented rows.** "Brooklyn enrolled in AP
  Physics", "Austin completed Algebra II Assessment", "New message from Dr.
  Alex" - names belonging to nobody in the database, identical on every parent
  account. Replaced with the real payment history from `getBilling`.

- [x] **The bio fell back to a fabricated one.** Any parent who had not written
  a bio was described as "Parent of Brooklyn and Austin. Passionate about
  ensuring my children receive the best academic support and guidance." It now
  shows nothing when there is nothing.

- [x] **The phone number was `+1 (555) 123-4567`,** hardcoded, for everyone.
  Reads `profiles.phone`.

- [x] **The three stat cards were invented:** 2 children, 3 active courses, and
  a "Next Payment Due" of Nov 15 that nothing calculated. Removed; the header
  carries contact details instead, which cannot go stale.


## Parent home (fixed 2026-08-11)

- [x] **The whole banner and agenda were fabricated.** `ParentHome` called
  `studentService.getDashboardSummary()`, which returns `MOCK_DASHBOARD_SUMMARY`
  after a fake 600ms delay: a session in "AP Calculus AB" with "Dr. Alex",
  homework called "Derivatives Practice", and four stats that were string
  literals in the JSX (3 courses, 2 children, 1 message, 4 classes). The page
  then hardcoded the name "Brooklyn" around it, because a student summary has
  no child to name.

  Replaced with `getParentDashboard`, built from the family's real rows:
  linked children, their upcoming sessions with the tutor, active enrolments,
  unread conversations and paid invoices. Every figure now belongs to somebody.


## Notes

- `.env` holds live credentials for both the hosted project and the local
  stack. It is gitignored, verified.
- Google Drive is the V1 file store for assignments and documents (URL
  references only), by design rather than a shortcut.
- Development runs against a local Supabase stack by default, so the hosted
  project is not written to during ordinary work. See `docs/DATABASE.md`.
