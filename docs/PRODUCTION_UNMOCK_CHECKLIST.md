# Production Un-Mock / Hardening Checklist

Things we **deliberately** left mocked, relaxed, or insecure to move fast during
development. **Every item here must be reviewed/reverted before a real production
launch.** Keep this file up to date as new shortcuts are added.

Legend: `[ ]` = still needs action before prod | `[x]` = handled

---

## Security-sensitive

- [ ] **DEV preview routes**, `src/config/dev.ts` → `DEV_PREVIEW = true`.
  Exposes public, no-auth routes (`/preview/onboarding/:role`, `/preview/pending/:role/:status`).
  Set to `false` before deploy. (A red console warning fires if a PROD build ships with it on.)

- [ ] **Notifications INSERT policy is wide open**, `docs/db_schema.sql`, policy
  "Authenticated users can insert notifications" allows any signed-in user to insert
  a notification for any `user_id`. Needed so clients can notify each other
  (student books → notifies tutor). Before prod, move notification creation into a
  `SECURITY DEFINER` RPC or DB triggers so clients can't forge notifications.

- [ ] **Demo accounts are pre-approved**, `docs/db_seed.sql` seeds tutor & counselor
  as `status = 'active'` (skipping the real approval gate) purely for demoing.
  Remove/disable demo seeding for production.

- [ ] **Demo login buttons**, `AuthPage.tsx` shows one-click demo logins with the
  shared password `demo123`. Remove for production.

## Data / correctness

- [ ] **Avatar upload bucket is optional**, if `docs/db_avatars_bucket.sql` isn't run,
  photo upload fails gracefully and only DiceBear avatars work. Run it for prod if
  uploads are wanted.

## Notes

- `.env` holds live Supabase credentials and is gitignored (not committed), verified.
- Google Drive is the V1 file store for assignments/documents (URL references only),
  by design, not a shortcut.
