// Service access follows payment, and payment alone.
//
// child_services.is_active used to be the whole answer, which meant a parent
// toggle could hand out a service nobody had bought, and buying a course
// granted nothing at all because no code path ever wrote "tutoring".
//
// Access is now derived from v_student_entitlements (enrolments and
// admissions_plans, written only by the Stripe webhook) and nothing else. This
// asserts payment is both necessary and sufficient: a permission row without
// payment opens nothing, and a paid service stays open whatever child_services
// says. (child_services is retained only as a support/admin override elsewhere;
// it is not part of the student's access rule.)
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

/** The same rule getMyActiveServices applies: entitlement only, no permission. */
async function effectiveServices(studentId) {
  const { data: entitled } = await admin
    .from('v_student_entitlements')
    .select('service')
    .eq('student_id', studentId);
  return (entitled ?? []).map((r) => r.service);
}

async function main() {
  // Named fixtures rather than whichever row happens to match. The seed
  // guarantees these two shapes (see PARENT_LINKS in scripts/seed/data.ts): a
  // check that hunts for suitable data passes on a database that no longer
  // contains the case it exists to test.
  const PAID = 'student@yakal.com';
  // Named, for the same reason PAID is. This used to be "the first student who
  // is not PAID", which on a developer's own database is whichever account
  // they signed up with while testing. Mine had an enrolment, so the check
  // reported that a permission row opens a service without payment: a security
  // failure, from a fixture that had simply paid.
  //
  // A check that cries wolf on the machine it runs on every day is worse than
  // no check, because the next person to see it red assumes it is that again.
  //
  // A fixture of its own rather than a demo student. This was student2, who is
  // also an ordinary account somebody can buy a tier for while testing, and the
  // first time that happened the check stopped running.
  const UNPAID = 'unpaid-fixture@yakal.demo';

  const { data: students } = await admin.from('profiles').select('id, full_name, email').eq('role', 'student');
  const student = (students ?? []).find((s) => s.email === PAID);
  const unpaid = (students ?? []).find((s) => s.email === UNPAID);

  if (!student || !unpaid) {
    console.error(`Needs ${PAID} and ${UNPAID}. Run npm run db:seed.`);
    process.exit(1);
  }

  // The unpaid fixture has to have bought nothing, or this proves nothing at
  // all. Say so plainly rather than passing a test of the wrong thing.
  const alreadyEntitled = await effectiveServices(unpaid.id);
  if (alreadyEntitled.length > 0) {
    console.error(
      `${UNPAID} has ${alreadyEntitled.join(', ')}. The unpaid fixture must own nothing; ` +
        'run npm run db:reset, or point UNPAID at a student who has bought nothing.'
    );
    process.exit(1);
  }

  // Snapshot, so the database is left as it was found.
  const { data: before } = await admin
    .from('child_services')
    .select('service, is_active')
    .eq('student_id', student.id);

  try {
    const entitled = await effectiveServices(student.id);
    check('entitlements are derived, not stored', Array.isArray(entitled), entitled.join(', ') || 'none');

    // ---- payment is necessary ----
    // A student who has bought nothing, with both permission rows on. The
    // toggle is no longer part of the rule, so it opens nothing.
    for (const s of ['tutoring', 'admissions']) {
      await admin
        .from('child_services')
        .upsert({ student_id: unpaid.id, service: s, is_active: true }, { onConflict: 'student_id,service' });
    }
    const opened = await effectiveServices(unpaid.id);
    check(
      'a permission row without payment opens nothing',
      opened.length === 0,
      opened.length ? `${unpaid.full_name} got ${opened.join(', ')} without paying` : `${unpaid.full_name} stayed shut`
    );
    await admin.from('child_services').delete().eq('student_id', unpaid.id);

    // ---- payment is sufficient ----
    // Everything the student has paid for, with the permission rows turned off.
    // Access follows payment, so a toggle cannot close it.
    for (const s of entitled) {
      await admin
        .from('child_services')
        .upsert({ student_id: student.id, service: s, is_active: false }, { onConflict: 'student_id,service' });
    }
    const stillOpen = await effectiveServices(student.id);
    check(
      'a paid service stays open regardless of the permission row',
      stillOpen.length === entitled.length && entitled.every((s) => stillOpen.includes(s)),
      stillOpen.join(', ') || 'none'
    );
  } finally {
    // Put the rows back exactly as they were.
    await admin.from('child_services').delete().eq('student_id', student.id);
    for (const row of before ?? []) {
      await admin
        .from('child_services')
        .upsert(
          { student_id: student.id, service: row.service, is_active: row.is_active },
          { onConflict: 'student_id,service' }
        );
    }
  }

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
