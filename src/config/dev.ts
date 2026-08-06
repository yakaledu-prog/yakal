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
 * Driven by `VITE_DEV_PREVIEW` so it can be on for a deployment you are
 * testing and off for the one real people use, without editing code and
 * redeploying to move between them. It was a hardcoded constant, which meant
 * the only way to demo anything was to ship the flag turned on and hope
 * somebody remembered to turn it back off.
 *
 * **Turning this on publishes accounts whose password is in this repository.**
 * `demo123` signs in as an admin, and the `/dev` console lists every account
 * and signs in as any of them. On a URL a customer can reach, that is the
 * whole database. Set it only where that is acceptable, and unset it before
 * anybody real has an account.
 *
 * Absent is off. It has to be exactly "true", so a stray value cannot open it
 * by accident.
 */
export const DEV_PREVIEW = import.meta.env.VITE_DEV_PREVIEW === "true";

if (DEV_PREVIEW && import.meta.env.PROD) {
  // Loud, and every reload, because the cost of forgetting is every account.

  console.warn(
    "%c[YAKAL] DEV_PREVIEW is ON in a production build: demo logins and /preview are public. Unset VITE_DEV_PREVIEW to close them.",
    "background:#b91c1c;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold"
  );
}
