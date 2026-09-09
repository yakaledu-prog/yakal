// Who may change a child's counselling plan.
//
// It was the purchaser alone. That locked out a second parent on the same
// child, and anybody whose plan was set up for them: purchased_by is null on a
// plan an admin created, and null matches nobody, so a parent opening Change
// plan was told "That is not your subscription" about their own child. The
// seeded demo plan was exactly that shape, which is how it was found.
//
// Either parent, the purchaser, or an admin. A student is still refused, which
// is the point of the check: they must not upgrade the plan a parent is paying
// for.
//
// The ownership answer is what this pins, so every case is read from the error
// rather than from Stripe: getting past ownership lands on the next check, and
// that is the pass condition.
//
// The handler is driven in process rather than over HTTP, so this needs the
// database and nothing else running.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${detail ? '  -> ' + detail : ''}`);
  if (!ok) failures++;
};

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function tokenFor(email: string) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.session!.access_token;
}

const handler = (await import('../../api/_handlers/subscription.js')).default;

async function change(token: string, planId: string, tierId: string) {
  const req: any = {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: { planId, tierId, op: 'change' },
  };
  let payload: any = null;
  const res: any = {
    status() { return res; },
    json(b: unknown) { payload = b; return res; },
    end() { return res; },
    setHeader() { return res; },
  };
  await handler(req, res);
  return (payload as { error?: string } | null)?.error ?? '';
}

const NOT_YOURS = /not your subscription/i;

const { data: plan } = await admin
  .from('admissions_plans')
  .select('id, student_id, purchased_by, tier_id')
  .in('status', ['active', 'past_due'])
  .limit(1)
  .maybeSingle();

if (!plan) {
  console.error('No admissions plan seeded. Run npm run db:reset.');
  process.exit(1);
}

const { data: tiers } = await admin.from('admissions_tiers').select('id').eq('is_active', true);
const otherTier = (tiers ?? []).find((t) => t.id !== plan.tier_id)?.id;
if (!otherTier) {
  console.error('Needs two active tiers to move between. Run npm run db:reset.');
  process.exit(1);
}

// The seed gives the plan an owner. Null was the state that produced the bug,
// so it is the state this runs against, and it is put back at the end.
const originalOwner = plan.purchased_by;
await admin.from('admissions_plans').update({ purchased_by: null }).eq('id', plan.id);

check('the seed gives the plan an owner', !!originalOwner, originalOwner ?? 'null');

const parent = await tokenFor('parent@yakal.com');
const student = await tokenFor('student@yakal.com');
const adminToken = await tokenFor('admin@yakal.com');

// A linked parent, with purchased_by null: the case that was refused.
const asParent = await change(parent, plan.id, otherTier);
check("a linked parent is not told it is somebody else's", !NOT_YOURS.test(asParent), asParent);

// An admin, which always worked and must keep working.
const asAdmin = await change(adminToken, plan.id, otherTier);
check('an admin still gets through', !NOT_YOURS.test(asAdmin), asAdmin);

// The student on the plan. Widening the rule must not have reached them.
const asStudent = await change(student, plan.id, otherTier);
check('the student it is for is still refused', NOT_YOURS.test(asStudent), asStudent);

// Somebody with no link to the child at all.
const { data: stranger } = await admin
  .from('profiles')
  .select('id, email')
  .eq('email', 'student2@yakal.com')
  .maybeSingle();
if (stranger) {
  const strangerToken = await tokenFor(stranger.email!);
  const asStranger = await change(strangerToken, plan.id, otherTier);
  check('an unrelated account is refused', NOT_YOURS.test(asStranger), asStranger);
}

await admin.from('admissions_plans').update({ purchased_by: originalOwner }).eq('id', plan.id);

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
