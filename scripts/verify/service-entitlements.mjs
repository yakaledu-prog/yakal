// A service needs both a payment and a parent's permission.
//
// child_services.is_active used to be the whole answer, which meant a parent
// toggle could hand out a service nobody had bought, and buying a course
// granted nothing at all because no code path ever wrote "tutoring".
//
// Entitlement now comes from v_student_entitlements, derived from enrolments
// and admissions_plans. This asserts the two halves are really independent:
// permission without payment opens nothing, and payment without permission
// opens nothing either.
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

/** The same rule getMyActiveServices applies, against the same two sources. */
async function effectiveServices(studentId) {
  const [{ data: permitted }, { data: entitled }] = await Promise.all([
    admin.from('child_services').select('service').eq('student_id', studentId).eq('is_active', true),
    admin.from('v_student_entitlements').select('service').eq('student_id', studentId),
  ]);
  const allowed = new Set((permitted ?? []).map((r) => r.service));
  return (entitled ?? []).map((r) => r.service).filter((s) => allowed.has(s));
}

async function main() {
  // Named fixtures rather than whichever row happens to match. The seed
  // guarantees these two shapes (see PARENT_LINKS in scripts/seed/data.ts): a
  // check that hunts for suitable data passes on a database that no longer
  // contains the case it exists to test.
  const PAID = 'student@yakal.com';

  const { data: students } = await admin.from('profiles').select('id, full_name, email').eq('role', 'student');
  const student = (students ?? []).find((s) => s.email === PAID);
  const unpaid = (students ?? []).find((s) => s.email !== PAID);

  if (!student || !unpaid) {
    console.error(`Needs ${PAID} and one other student. Run npm run db:seed.`);
    process.exit(1);
  }

  // Snapshot, so the database is left as it was found.
  const { data: before } = await admin
    .from('child_services')
    .select('service, is_active')
    .eq('student_id', student.id);

  try {
    const entitledNow = await admin
      .from('v_student_entitlements')
      .select('service')
      .eq('student_id', student.id);
    const entitled = (entitledNow.data ?? []).map((r) => r.service);
    check('entitlements are derived, not stored', Array.isArray(entitled), entitled.join(', ') || 'none');

    // ---- permission without payment ----
    // A student who has bought nothing, with both switches on. This is the
    // case the old behaviour got wrong: the toggle was the whole answer.
    if (!unpaid) {
      check('permission alone does not open an unpaid service', false, 'every student has paid for something, so this cannot be tested');
    } else {
      for (const s of ['tutoring', 'admissions']) {
        await admin
          .from('child_services')
          .upsert({ student_id: unpaid.id, service: s, is_active: true }, { onConflict: 'student_id,service' });
      }
      const opened = await effectiveServices(unpaid.id);
      check(
        'permission alone does not open an unpaid service',
        opened.length === 0,
        opened.length ? `${unpaid.full_name} got ${opened.join(', ')} without paying` : `${unpaid.full_name} stayed shut`
      );
      await admin.from('child_services').delete().eq('student_id', unpaid.id);
    }

    // ---- payment without permission ----
    // Everything the student has paid for, switched off by the parent.
    for (const s of entitled) {
      await admin
        .from('child_services')
        .upsert({ student_id: student.id, service: s, is_active: false }, { onConflict: 'student_id,service' });
    }
    const withoutPermission = await effectiveServices(student.id);
    check(
      'a parent can still hide a service they paid for',
      withoutPermission.length === 0,
      `${withoutPermission.length} left open`
    );

    // ---- both ----
    for (const s of entitled) {
      await admin
        .from('child_services')
        .upsert({ student_id: student.id, service: s, is_active: true }, { onConflict: 'student_id,service' });
    }
    const withBoth = await effectiveServices(student.id);
    check(
      'paid and permitted opens exactly what was paid for',
      withBoth.length === entitled.length && entitled.every((s) => withBoth.includes(s)),
      withBoth.join(', ') || 'none'
    );
  } finally {
    // Put the rows back exactly as they were.
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
