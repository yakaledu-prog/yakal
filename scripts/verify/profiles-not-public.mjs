// profiles is not readable without an account, and the marketing site is fine.
//
// The old policy was SELECT TO public USING (true). `public` includes `anon`,
// and the anon key is in the browser bundle, so every row was readable by
// anyone: name, email, phone, stripe_account_id. This asserts that is closed,
// and that closing it did not take the landing page with it.
import { execSync } from 'node:child_process';
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
  // ---- signed out ----
  const { data: leaked, error } = await anon.from('profiles').select('id, full_name, email');
  check(
    'anon cannot read profiles',
    (leaked ?? []).length === 0,
    error?.code ?? `${(leaked ?? []).length} rows came back`
  );

  // The whole point of the view: the marketing site still has its tutors.
  const { data: tutors, error: viewErr } = await anon
    .from('v_public_tutors')
    .select('id, full_name, bio');
  check('anon can still read v_public_tutors', !viewErr, viewErr?.message ?? `${(tutors ?? []).length} tutors`);

  // And that view must not be a way back to the columns just protected.
  // select('*') on purpose: a column added to the view later should fail this
  // rather than sail past a hardcoded list.
  const { data: sample } = await anon.from('v_public_tutors').select('*').limit(1);
  const exposed = Object.keys(sample?.[0] ?? {});
  check(
    'the public view exposes no contact details',
    exposed.length > 0 && !exposed.some((c) => ['email', 'phone', 'stripe_account_id'].includes(c)),
    exposed.join(', ') || '(no rows to inspect)'
  );

  // ---- signed in ----
  // Every dashboard reads profiles, so this must keep working or the fix has
  // traded one outage for another.
  const { data: people } = await admin.from('profiles').select('id, email').limit(1);
  if (!people?.length) {
    check('a seeded account exists to sign in as', false, 'seed the database first');
  } else {
    const { data: signIn, error: authErr } = await anon.auth.signInWithPassword({
      email: people[0].email,
      password: 'demo123',
    });
    if (authErr || !signIn?.session) {
      check('signed-in read still works', false, `could not sign in: ${authErr?.message}`);
    } else {
      const asUser = createClient(URL, ANON, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
      });
      const { data: rows, error: readErr } = await asUser.from('profiles').select('id').limit(5);
      check(
        'a signed-in user can still read profiles',
        !readErr && (rows ?? []).length > 0,
        readErr?.message ?? `${(rows ?? []).length} rows`
      );
      await anon.auth.signOut();
    }
  }

  // ---- the private columns (20260920000400) ----
  //
  // Signed in is not the same as entitled. phone, the two Stripe fields, the
  // CV and a rejection reason are readable by their owner and by admins, and
  // only through full_profiles; the table no longer hands them to anybody.
  const PRIVATE = ['phone', 'stripe_account_id', 'stripe_payouts_enabled', 'resume_url', 'rejection_reason'];
  const signInAs = async (email) => {
    const c = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error: e } = await c.auth.signInWithPassword({ email, password: 'demo123' });
    if (e) throw new Error(`could not sign in as ${email}: ${e.message}`);
    return { c, id: data.user.id };
  };
  const student = await signInAs('student@yakal.com');
  const adminUser = await signInAs('admin@yakal.com');

  for (const col of PRIVATE) {
    const { error: e } = await student.c.from('profiles').select(`id, ${col}`).neq('id', student.id).limit(1);
    check(`a student cannot read another user's ${col}`, !!e, e?.message ?? 'it came back');
  }
  const { error: starErr } = await student.c.from('profiles').select('*').limit(1);
  check("select('*') on profiles is refused, so nothing can ask for everything", !!starErr, starErr?.message ?? 'allowed');

  const { data: mine, error: mineErr } = await student.c.rpc('full_profiles').select('id, phone');
  check(
    'full_profiles gives a student their own row and nobody else\'s',
    !mineErr && (mine ?? []).length === 1 && mine[0].id === student.id,
    mineErr?.message ?? `${(mine ?? []).length} row(s)`
  );
  const { data: all, error: allErr } = await adminUser.c.rpc('full_profiles').select('id, phone, resume_url');
  check('and an admin everybody\'s', !allErr && (all ?? []).length > 1, allErr?.message ?? `${(all ?? []).length} rows`);
  const { error: anonFp } = await anon.rpc('full_profiles');
  check('full_profiles is not callable signed out', !!anonFp, anonFp?.message ?? 'allowed');

  // Everything else stays readable. A column the grant missed would break a
  // dashboard silently, one screen at a time; this names it instead.
  const missing = execSync(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAq -c "` +
      `select string_agg(c.column_name, ', ') from information_schema.columns c ` +
      `where c.table_schema='public' and c.table_name='profiles' ` +
      `and c.column_name not in (${PRIVATE.map((x) => `'${x}'`).join(',')}) ` +
      `and not has_column_privilege('authenticated', 'public.profiles', c.column_name, 'SELECT')"`
  )
    .toString()
    .trim();
  check('every other column is still readable when signed in', missing === '', missing || '');

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
