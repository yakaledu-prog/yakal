// A signed-in user cannot promote themselves, and can still edit their own bio.
//
// "Users can update their own profile" was FOR UPDATE USING (auth.uid() = id)
// with no WITH CHECK. Postgres reuses USING as the check, and id never changes,
// so a user could set any other column on their own row, including role. One
// PATCH made them an admin. 20260822000100 adds a BEFORE UPDATE trigger that
// pins role, status and the stripe_* columns to admins and the service role.
//
// This asserts the hole is closed both ways: the escalation fails, and an
// ordinary self-edit still works, so the fix did not just freeze the row.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON =
  process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

async function main() {
  // A non-admin to act as. Students are the most numerous seeded role and the
  // least privileged, so they are the sharpest test of the escalation.
  const { data: victimList } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('role', 'student')
    .not('email', 'is', null)
    .limit(1);

  const victim = victimList?.[0];
  if (!victim) {
    check('a seeded non-admin account exists', false, 'seed the database first');
    console.log(`\n${failures} failed`);
    process.exit(1);
  }

  const { data: signIn, error: authErr } = await anon.auth.signInWithPassword({
    email: victim.email,
    password: 'demo123',
  });
  if (authErr || !signIn?.session) {
    check('can sign in as the non-admin', false, `could not sign in: ${authErr?.message}`);
    console.log(`\n${failures} failed`);
    process.exit(1);
  }

  const asUser = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });

  // ---- the escalation must fail ----
  await asUser.from('profiles').update({ role: 'admin' }).eq('id', victim.id);
  // Read the truth back with the service key: RLS could hide a row the update
  // did touch, so trust the stored value, not the update's own response.
  const { data: afterRole } = await admin
    .from('profiles')
    .select('role')
    .eq('id', victim.id)
    .single();
  check(
    'a student cannot make themselves an admin',
    afterRole?.role === 'student',
    `role is now ${afterRole?.role}`
  );

  // ---- the same gap covered status and payouts ----
  await asUser.from('profiles').update({ status: 'active' }).eq('id', victim.id);
  await asUser
    .from('profiles')
    .update({ stripe_payouts_enabled: true, stripe_account_id: 'acct_attacker' })
    .eq('id', victim.id);
  const { data: afterPayout } = await admin
    .from('profiles')
    .select('stripe_payouts_enabled, stripe_account_id')
    .eq('id', victim.id)
    .single();
  check(
    'a user cannot switch on their own payouts',
    afterPayout?.stripe_payouts_enabled === false && afterPayout?.stripe_account_id !== 'acct_attacker',
    `payouts=${afterPayout?.stripe_payouts_enabled} account=${afterPayout?.stripe_account_id ?? 'null'}`
  );

  // ---- an ordinary self-edit still works ----
  // The fix must not freeze the whole row: bio, theme, avatar and the like are
  // exactly what this policy is meant to allow.
  const marker = `verify ${Date.now()}`;
  const { error: bioErr } = await asUser
    .from('profiles')
    .update({ bio: marker })
    .eq('id', victim.id);
  const { data: afterBio } = await admin
    .from('profiles')
    .select('bio')
    .eq('id', victim.id)
    .single();
  check(
    'a user can still edit their own bio',
    !bioErr && afterBio?.bio === marker,
    bioErr?.message ?? afterBio?.bio
  );

  // ---- the service role (the webhook) can still write payout state ----
  await admin
    .from('profiles')
    .update({ stripe_payouts_enabled: true })
    .eq('id', victim.id);
  const { data: afterService } = await admin
    .from('profiles')
    .select('stripe_payouts_enabled')
    .eq('id', victim.id)
    .single();
  check(
    'the service role can still set payout state',
    afterService?.stripe_payouts_enabled === true,
    `payouts=${afterService?.stripe_payouts_enabled}`
  );

  // Put it back so a re-run starts clean.
  await admin
    .from('profiles')
    .update({ stripe_payouts_enabled: false, stripe_account_id: null, bio: null })
    .eq('id', victim.id);
  await anon.auth.signOut();

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
