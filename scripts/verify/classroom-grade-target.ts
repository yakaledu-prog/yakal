// A grade only writes back to a Classroom submission when the student is on the
// class roster: match by email to the Classroom user id, then to their
// submission. A student who is not a member (the usual case under the no-sign-in
// model) resolves to null, so nothing is written rather than the wrong row.
import { classroomSubmissionFor } from "../../api/_utils/classroom-grade-target.ts";

const roster = [
  { userId: "u-amara", email: "Amara@Yakal.com" },
  { userId: "u-ben", email: "ben@yakal.com" },
];
const submissions = [
  { id: "sub-1", userId: "u-ben" },
  { id: "sub-2", userId: "u-amara" },
];

const hit = classroomSubmissionFor("amara@yakal.com", roster, submissions); // case-insensitive
const noEmail = classroomSubmissionFor(null, roster, submissions);
const notMember = classroomSubmissionFor("stranger@yakal.com", roster, submissions);
const memberNoSubmission = classroomSubmissionFor("ben@yakal.com", roster, [{ id: "sub-2", userId: "u-amara" }]);

let failed = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) {
    failed++;
    console.error(`FAIL  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};
eq("roster match by email", hit, "sub-2");
eq("no email", noEmail, null);
eq("not a class member", notMember, null);
eq("member with no submission", memberNoSubmission, null);

if (failed > 0) process.exit(1);
console.log("ok    Classroom grade write-back targets the roster-matched submission only");
