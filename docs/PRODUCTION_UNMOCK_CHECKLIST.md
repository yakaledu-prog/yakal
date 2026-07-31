# Production un-mock and hardening checklist

Things deliberately left mocked, relaxed or insecure to move fast during
development. **Every item here must be reviewed or reverted before a real
production launch.** Keep it up to date as new shortcuts are added.

Legend: `[ ]` still needs action before production, `[x]` handled

---

## Security

- [ ] **Dev preview routes**, `src/config/dev.ts` -> `DEV_PREVIEW = true`.
  Exposes public, no-auth routes (`/preview/onboarding/:role`,
  `/preview/pending/:role/:status`). Set to `false` before deploy. A red
  console warning fires if a production build ships with it on.

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

- [ ] **Demo login buttons**, `src/pages/shared/AuthPage.tsx` shows one-click
  logins for those accounts. Remove for production.

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

The mock surface is deliberately concentrated: `src/mock/index.ts` is the only
module holding hardcoded application data. When it is empty, the app runs
entirely on the database.

## Notes

- `.env` holds live credentials for both the hosted project and the local
  stack. It is gitignored, verified.
- Google Drive is the V1 file store for assignments and documents (URL
  references only), by design rather than a shortcut.
- Development runs against a local Supabase stack by default, so the hosted
  project is not written to during ordinary work. See `docs/DATABASE.md`.
