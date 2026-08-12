import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase access for the serverless functions.
 *
 * Separate from billing.ts on purpose. These helpers say nothing about money,
 * but they used to live beside getStripe, so importing requireUser pulled the
 * whole Stripe SDK in behind it. Vercel bundles a function from what it
 * imports and rejects it over 250 MB unzipped, which is how the Google
 * function - which never bills anything - ended up carrying Stripe and failing
 * to invoke at all. Keep this file free of anything a caller might not want.
 */

/**
 * Which Supabase this request belongs to.
 *
 * The browser picks between the local Docker stack and the hosted project (see
 * src/lib/supabase.ts, which defaults to local in development). The API used
 * VITE_SUPABASE_URL unconditionally, so in development it handed a token
 * issued by the local stack to the hosted project's auth, which rightly
 * rejected it. Every billing call came back 401 and no course could be booked
 * locally.
 *
 * The rule matches the frontend: an explicit flag wins, otherwise production
 * means the hosted project and anything else means local.
 */
function target(): { url: string; anonKey: string; serviceKey: string } {
  const configured = process.env.BACKEND || process.env.VITE_BACKEND;
  const isProduction =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const backend = configured === 'local' || configured === 'remote'
    ? configured
    : isProduction ? 'remote' : 'local';

  if (backend === 'local') {
    // The keys the Supabase CLI issues for every local stack. Local only, and
    // not a secret: they are printed by `supabase start`.
    return {
      url: process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321',
      anonKey:
        process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      serviceKey:
        process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    };
  }

  return {
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

// Service-role client - bypasses RLS. Server-only; never expose the key.
export function getServiceClient(): SupabaseClient {
  const { url, serviceKey } = target();
  if (!url || !serviceKey) throw new Error('Supabase service-role credentials are not configured');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Verify the caller's Supabase access token and return their user id.
export async function requireUser(req: any): Promise<{ id: string; email: string | null }> {
  const header: string = req.headers?.authorization || req.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Missing authorization token');

  const { url, anonKey } = target();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new Error('Invalid or expired session');
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * A client that acts as the caller rather than as the server.
 *
 * Needed wherever a database function decides something from auth.uid(): the
 * service client is nobody, so those checks would all pass or all fail rather
 * than answering for the person who asked.
 */
export function getUserClient(req: any): SupabaseClient {
  const header: string = req.headers?.authorization || req.headers?.Authorization || '';
  const { url, anonKey } = target();
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: header } },
  });
}

/**
 * The public origin the app is served from, for links Stripe and Google send
 * the browser back to (checkout success, portal return, Connect onboarding).
 *
 * APP_BASE_URL wins when set, with any trailing slash stripped so callers can
 * append a path without producing "//parent/billing" (which React Router does
 * not match, and answers with the 404 page).
 *
 * It used to be the only source, defaulting to http://localhost:5173. A deploy
 * that forgot to set it therefore sent every Stripe redirect to localhost -
 * which on a payer's machine is their own machine - so checkout finished on a
 * broken page instead of the paid screen. Here the API and the built app are
 * the same origin, so the request already carries the right host: we fall back
 * to that. Plain localhost stays only as the last resort for a context with no
 * request and no env (local scripts).
 */
export function appBaseUrl(req?: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;

  if (req) {
    const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    // x-forwarded-* are what Render's proxy sets; host is the direct fallback.
    const host = pick(req.headers['x-forwarded-host']) || pick(req.headers.host);
    if (host) {
      const proto = pick(req.headers['x-forwarded-proto']) || 'https';
      return `${proto}://${host}`;
    }
  }
  return 'http://localhost:5173';
}
