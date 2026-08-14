// Classroom topics group work without hiding local or unfiled assignments.
// This is intentionally one small check: the grouping loop is the only new
// logic, and a UI test would duplicate the component rather than test it.
import { groupCourseWorkByTopic } from "../../src/utils/courseWorkTopics.ts";

const rows = [
  { id: "a", index: 8, topicId: "unit-2" },
  { id: "b", index: 9, topicId: null },
  { id: "c", index: 10, topicId: "unit-1" },
];
const grouped = groupCourseWorkByTopic(rows, [
  { id: "unit-1", name: "Foundations" },
  { id: "unit-2", name: "Quadratics" },
]);

const actual = grouped?.map((section) => ({
  name: section.name,
  ids: section.items.map((item) => item.id),
  indexes: section.items.map((item) => item.index),
}));
const expected = [
  { name: "Foundations", ids: ["c"], indexes: [1] },
  { name: "Quadratics", ids: ["a"], indexes: [1] },
  { name: "Other work", ids: ["b"], indexes: [1] },
];

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error("FAIL  Classroom topic grouping", { actual, expected });
  process.exit(1);
}
console.log("ok    Classroom topic grouping preserves topic order and unfiled work");
