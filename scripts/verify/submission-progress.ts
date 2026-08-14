// A course's progress is rolled up from one student's submissions: submitted
// counts a turn-in whatever its status, graded counts a present grade, and the
// average is over the grades that exist. One small check of the pure summary;
// the service wrapper only feeds it rows.
import { summarizeProgress } from "../../src/utils/courseProgress.ts";

const assignmentIds = ["a1", "a2", "a3", "a4"];
const submissions = [
  { assignment_id: "a1", status: "reviewed", grade: 80 },
  { assignment_id: "a2", status: "submitted", grade: null },
  { assignment_id: "a3", status: "reviewed", grade: 100 },
  // a4 is not turned in.
];

const actual = summarizeProgress(assignmentIds, submissions);
const expected = { total: 4, submitted: 3, graded: 2, averageGrade: 90 };

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error("FAIL  course progress", { actual, expected });
  process.exit(1);
}
console.log("ok    course progress counts submitted, graded and averages the grades");
