// ============================================================
// DEV / PRE-PRODUCTION FLAGS
// ------------------------------------------------------------
// Anything here is a DELIBERATE shortcut for development or demos.
// Every flag MUST be reviewed before a production deploy.
// See docs/PRODUCTION_UNMOCK_CHECKLIST.md for the full list.
// ============================================================

/**
 * Exposes the no-auth preview routes (`/preview/*`), the `/dev` console, and
 * the one-click demo logins on the sign-in page.
 *
 * Driven by `VITE_DEV_PREVIEW` so it can be on for `npm run dev` without
 * editing code. It was a hardcoded constant, which meant the only way to demo
 * anything was to ship the flag turned on and hope somebody remembered to turn
 * it back off.
 *
 * **Never in a production build, whatever the variable says.** This used to
 * trust the variable and print a red console warning when it was on in a
 * production build, on the theory that a deployment you were testing and the
 * one real people use would be different URLs. There is one deployment, it is
 * production, and the variable was left on there: `demo123` signed in as an
 * admin from the login page, and `/dev` listed every account and signed in as
 * any of them. A warning nobody opens the console to read protected nothing,
 * so the build decides now, not the environment.
 *
 * Absent is off. It has to be exactly "true", so a stray value cannot open it
 * by accident.
 */
export const DEV_PREVIEW = import.meta.env.VITE_DEV_PREVIEW === "true" && !import.meta.env.PROD;
