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

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:5173';
}
