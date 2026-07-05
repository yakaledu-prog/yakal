// ============================================================
// DEV / PRE-PRODUCTION FLAGS
// ------------------------------------------------------------
// Anything here is a DELIBERATE shortcut for development or demos.
// Every flag MUST be reviewed before a production deploy.
// See docs/PRODUCTION_UNMOCK_CHECKLIST.md for the full list.
// ============================================================

/**
 * Exposes public, no-auth preview routes for designing onboarding / pending
 * screens (e.g. /preview/onboarding/tutor). MUST be false in production,
 * otherwise anyone can reach these routes without logging in.
 */
export const DEV_PREVIEW = false;

if (DEV_PREVIEW && import.meta.env.PROD) {
  // Loud warning if a production build ships with previews enabled.
  // eslint-disable-next-line no-console
  console.warn(
    "%c[YAKAL] DEV_PREVIEW is ON in a production build. Disable it in src/config/dev.ts before shipping.",
    "background:#b91c1c;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold"
  );
}
