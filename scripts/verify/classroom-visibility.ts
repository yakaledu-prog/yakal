import { isVisibleTo, type Reader } from '../../api/_handlers/classroom.js';

// ============================================================
// Individually assigned coursework must not leak between students.
//
// The read-through returns a whole class's courseWork to every entitled
// reader. That is correct for the syllabus model, where every assignment goes
// to everyone. It stops being correct the moment a tutor uses Classroom's own
// "assign to specific students" option, which is a button in the dialog they
// already work in.
//
// Nobody plans to use it. That is exactly why this is here: the failure is
// silent, it leaks one student's work to another, and we would learn about it
// from a parent rather than from a log.
// ============================================================

const staff: Reader = { kind: 'staff' };
const learner: Reader = { kind: 'learner', email: 'amina@example.com' };
const denied: Reader = { kind: 'denied' };

const forEveryone = { assigneeMode: 'ALL_STUDENTS' };
const forAmina = {
  assigneeMode: 'INDIVIDUAL_STUDENTS',
  individualStudentsOptions: { studentIds: ['google-amina'] },
};

let failures = 0;
function check(name: string, actual: boolean, expected: boolean) {
  if (actual === expected) console.log(`ok    ${name}`);
  else {
    console.error(`FAIL  ${name}\n        expected ${expected}, got ${actual}`);
    failures++;
  }
}

// The ordinary case, and the only one the syllabus model produces.
check('everyone sees work assigned to all', isVisibleTo(forEveryone, learner, 'google-amina'), true);
check('a reader with no Google id still sees shared work', isVisibleTo(forEveryone, learner, null), true);

// The leak this exists to prevent.
check('Amina sees work assigned to Amina', isVisibleTo(forAmina, learner, 'google-amina'), true);
check('Yonas does not see work assigned to Amina', isVisibleTo(forAmina, learner, 'google-yonas'), false);

// Unresolvable readers are hidden from, not shown to. A learner who is not a
// member of the class cannot be proven to be an assignee, and the safe answer
// to "I cannot tell" is no.
check(
  'an unplaceable learner is excluded from individual work',
  isVisibleTo(forAmina, learner, null),
  false
);

// Teachers and admins read the class as a teacher does.
check('staff see individually assigned work', isVisibleTo(forAmina, staff, null), true);

// Belt and braces: the handler returns early on denied, but the rule should
// not depend on that.
check('a denied reader sees nothing', isVisibleTo(forEveryone, denied, 'google-amina'), false);

// Classroom sends ids as strings, but a JSON round trip elsewhere could make
// one a number. Matching must not depend on that.
check(
  'ids compare as strings',
  isVisibleTo(
    { assigneeMode: 'INDIVIDUAL_STUDENTS', individualStudentsOptions: { studentIds: [12345 as never] } },
    learner,
    '12345'
  ),
  true
);

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
