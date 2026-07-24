import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Shared helpers for the Stripe billing serverless functions.

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  // Let the SDK use its pinned apiVersion (2026-06-24.dahlia).
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

// Service-role client — bypasses RLS. Server-only; never expose the key.
export function getServiceClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('Supabase service-role credentials are not configured');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Verify the caller's Supabase access token and return their user id.
export async function requireUser(req: any): Promise<{ id: string; email: string | null }> {
  const header: string = req.headers?.authorization || req.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Missing authorization token');

  const url = process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new Error('Invalid or expired session');
  return { id: data.user.id, email: data.user.email ?? null };
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:5173';
}
