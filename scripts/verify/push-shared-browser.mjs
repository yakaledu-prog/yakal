// Turning on notifications in a browser somebody else already used.
//
// The endpoint is one row per browser. The browser saved it with an upsert,
// so the second person on a shared laptop collided with the first person's
// row and RLS refused the update: "new row violates row-level security policy
// (USING expression) for table push_subscriptions". Now the browser calls
// claim_push_subscription, which hands the endpoint to whoever asked.
//
// Needs the local Supabase. Cleans up its own row.

import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON =
  process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const opts = { auth: { persistSession: false } };
const admin = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);

let failures = 0;
const pass = (s, ok, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

async function as(email) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

const endpoint = `https://push.example.test/verify-${Date.now()}`;
const sub = (ua) => ({ p_endpoint: endpoint, p_p256dh: 'key-p256dh', p_auth: 'key-auth', p_user_agent: ua });
const owner = async () =>
  (await admin.from('push_subscriptions').select('user_id').eq('endpoint', endpoint).maybeSingle()).data?.user_id;

const parent = await as('parent@yakal.com');
const student = await as('student@yakal.com');

try {
  let r = await parent.c.rpc('claim_push_subscription', sub('laptop'));
  pass('the first person turns notifications on', !r.error && (await owner()) === parent.id, r.error?.message);

  // What the browser used to do, kept so the reason for the function stays visible.
  r = await student.c.from('push_subscriptions').upsert(
    { user_id: student.id, endpoint, p256dh: 'k', auth: 'k' },
    { onConflict: 'endpoint' }
  );
  pass('a plain upsert on the same browser is still refused by RLS', !!r.error, r.error?.message ?? 'it went through');

  r = await student.c.rpc('claim_push_subscription', sub('laptop'));
  pass('the second person takes the browser over', !r.error && (await owner()) === student.id, r.error?.message);

  const { data: seen } = await parent.c.from('push_subscriptions').select('id').eq('endpoint', endpoint);
  pass('and the first person no longer has it', (seen ?? []).length === 0);

  r = await anon.rpc('claim_push_subscription', sub('x'));
  pass('nobody signed out can claim one', !!r.error, r.error?.message ?? 'allowed');

  r = await student.c.rpc('claim_push_subscription', { ...sub('x'), p_endpoint: 'javascript:alert(1)' });
  pass('an endpoint that is not https is refused', !!r.error, r.error?.message ?? 'allowed');
} finally {
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
