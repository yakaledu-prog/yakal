import { readSubmission, submittersByWork } from '../../api/_handlers/classroom.js';

// ============================================================
// Reading submission state out of Classroom.
//
// Two things here have bitten before and are easy to get wrong again.
//
// The first is draftGrade. Classroom keeps an unreturned mark on the
// submission next to the returned one, and reading the wrong field tells a
// student a result their tutor has not handed back. That is not a rendering
// bug, it is telling somebody they got 4/10 while the tutor is still deciding.
//
// The second is which states count as handed in. RETURNED is a marked paper
// given back, so it was turned in; reading only TURNED_IN quietly drops every
// assignment that has already been through marking, which is most of a term.
// ============================================================

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) console.log(`ok    ${name}`);
  else {
    console.error(`FAIL  ${name}\n        expected ${b}\n        got      ${a}`);
    failures++;
  }
}

// --- what counts as handed in -------------------------------------------

const states: [string, boolean][] = [
  ['NEW', false],
  ['CREATED', false],
  ['RECLAIMED_BY_STUDENT', false],
  ['TURNED_IN', true],
  ['RETURNED', true],
];
for (const [state, expected] of states) {
  check(`${state} is ${expected ? '' : 'not '}submitted`, readSubmission({ state }).isSubmitted, expected);
}

// --- the grade a student is allowed to see -------------------------------

check(
  'an assigned grade is reported',
  readSubmission({ state: 'RETURNED', assignedGrade: 8, draftGrade: 4 }).grade,
  8
);
check(
  'a draft grade is not a grade',
  readSubmission({ state: 'TURNED_IN', draftGrade: 4 }).grade,
  null
);
check('zero is a grade, not a missing one', readSubmission({ assignedGrade: 0 }).grade, 0);
check('no grade at all is null', readSubmission({ state: 'NEW' }).grade, null);

// Classroom omits `late` rather than sending false, and ids arrive as strings
// but a JSON round trip elsewhere could make one a number.
check('a missing late flag is false', readSubmission({ state: 'TURNED_IN' }).late, false);
check('ids are strings', readSubmission({ courseWorkId: 12, userId: 34 }).courseWorkId, '12');

// --- the tutor's rollup ---------------------------------------------------

const roster = new Map([
  ['g-amina', { name: 'Amina Tesfaye', avatarUrl: 'https://example.test/a.jpg' }],
  ['g-yonas', { name: 'Yonas Bekele', avatarUrl: null }],
]);

const submissions = [
  readSubmission({ courseWorkId: 'w1', userId: 'g-amina', state: 'TURNED_IN' }),
  readSubmission({ courseWorkId: 'w1', userId: 'g-yonas', state: 'NEW' }),
  readSubmission({ courseWorkId: 'w2', userId: 'g-yonas', state: 'RETURNED', assignedGrade: 9 }),
];

const rollup = submittersByWork(submissions, roster);

check('only submitters are counted', Object.keys(rollup).sort(), ['w1', 'w2']);
check('a submitter is named from the roster', rollup.w1, [
  { id: 'g-amina', name: 'Amina Tesfaye', avatarUrl: 'https://example.test/a.jpg' },
]);
check('a returned paper still counts as turned in', rollup.w2?.length, 1);
check('nobody turned in means no key, not an empty list', rollup.w3, undefined);

// A student who left the class keeps their submission in Classroom. Dropping
// them would silently reduce a count the tutor may already have acted on.
const withStranger = submittersByWork(
  [readSubmission({ courseWorkId: 'w1', userId: 'g-gone', state: 'TURNED_IN' })],
  roster
);
check('a submitter off the roster is kept, unnamed', withStranger.w1, [
  { id: 'g-gone', name: 'Student', avatarUrl: null },
]);

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
