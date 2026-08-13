import { createClient } from '@supabase/supabase-js'

// ============================================================
// Which backend the app talks to.
//
//   VITE_BACKEND=local    the Supabase stack running in Docker on this machine
//   VITE_BACKEND=remote   the hosted project
//
// Both sets of credentials live in .env at the same time, so switching is one
// variable, not a copy-paste job. Unset, it means local in dev and remote in a
// production build.
//
// Local mode is the default for day to day work: `npm run db:reset` rebuilds
// the database from supabase/migrations and reseeds it in a few seconds, so a
// breaking schema change costs nothing and the hosted data is never touched.
// Signup and login work fully offline, and any email the app sends lands in
// Mailpit at http://localhost:54324 instead of a real inbox.
//
// See docs/DATABASE.md.
// ============================================================

type Backend = 'local' | 'remote'

const configured = import.meta.env.VITE_BACKEND as string | undefined

const asked: Backend =
  configured === 'local' || configured === 'remote'
    ? configured
    : import.meta.env.DEV
      ? 'local'
      : 'remote'

/**
 * Whether this page is actually running on the machine the stack would be on.
 *
 * `vite preview` is a production build served from localhost and is a
 * legitimate way to test against the local database, so the guard below is
 * about where the page is, not how it was built.
 */
const servedLocally =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

/**
 * A deployed site cannot talk to somebody's Docker stack, whatever it is told.
 *
 * VITE_BACKEND=local reached a deployment's environment variables, pasted in
 * with the rest of a .env, and the live site spent every request on
 * 127.0.0.1:54321. Sign-in, the tier list, the blog and the tutor list all
 * failed with a connection refused, and none of it could work for anyone.
 *
 * A variable that can only ever be wrong off localhost should not be able to
 * be wrong there.
 */
export const BACKEND: Backend =
  asked === 'local' && !servedLocally ? 'remote' : asked

if (asked !== BACKEND) {
  console.warn(
    'VITE_BACKEND=local was ignored: this is not running on localhost, so the ' +
      'hosted project is used instead. Remove VITE_BACKEND from the deployment.'
  )
}

// The local anon key is the fixed demo JWT the Supabase CLI issues for every
// local stack. It grants nothing outside this machine, so it is safe to commit.
const LOCAL_FALLBACK_URL = 'http://127.0.0.1:54321'
const LOCAL_FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabaseUrl =
  BACKEND === 'local'
    ? import.meta.env.VITE_SUPABASE_LOCAL_URL || LOCAL_FALLBACK_URL
    : import.meta.env.VITE_SUPABASE_URL

const supabaseAnonKey =
  BACKEND === 'local'
    ? import.meta.env.VITE_SUPABASE_LOCAL_ANON_KEY || LOCAL_FALLBACK_ANON_KEY
    : import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    BACKEND === 'local'
      ? 'Missing local Supabase credentials. Run `npm run db:start` to bring the stack up.'
      : 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set both in the ' +
        'deployment\'s environment variables, or in .env when running locally.'
  )
}

if (import.meta.env.DEV) {
  const style =
    BACKEND === 'local'
      ? 'background:#1099A1;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold'
      : 'background:#b45309;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold'
  // Loud on purpose. Writing to the hosted database while you think you are on
  // a local throwaway is the expensive mistake this line is here to prevent.
  console.info(
    `%c[YAKAL] backend: ${BACKEND}%c ${supabaseUrl}`,
    style,
    'color:inherit'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keep the session in sessionStorage rather than localStorage, so closing
    // the tab or the browser ends it. The dashboard holds billing and payment
    // details, and a token that outlives the tab on a shared machine is exactly
    // the exposure we do not want. sessionStorage is also per-tab, so a session
    // never silently travels into a newly opened tab; the walked-away-but-tab-
    // still-open case is covered separately by the inactivity sign-out in
    // components/shared/IdleTimeout.
    //
    // Guarded for the verify scripts, which import this module under plain Node
    // where there is no window: they fall back to Supabase's in-memory store.
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    // Kept on: the Google sign-in and the password-reset link both hand the
    // session back in the URL for the client to pick up.
    detectSessionInUrl: true,
  },
})
