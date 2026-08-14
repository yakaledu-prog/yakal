// The rows the read-through mirrors into native assignments carry the Classroom
// courseWork id as external_id and the resolved topic name, so a later
// submission and grade have a stable row to attach to. One small check of the
// mapping; the upsert itself is idempotent through the unique index.
import { assignmentUpsertRows } from "../../api/_utils/classroom-rows.ts";

const rows = assignmentUpsertRows(
  "course-1",
  "tutor-1",
  [
    {
      id: "cw-9",
      title: "Quadratics worksheet",
      description: "Do the odd ones",
      materials: [{ title: "Sheet", link: "https://x/y" }],
      dueDate: "2026-09-01",
      maxPoints: 20,
      link: "https://classroom/cw-9",
      topicId: "unit-2",
    },
    {
      id: "cw-10",
      title: "Reading",
      description: null,
      materials: [],
      dueDate: null,
      maxPoints: null,
      link: null,
      topicId: null,
    },
  ],
  [
    { id: "unit-1", name: "Foundations" },
    { id: "unit-2", name: "Quadratics" },
  ],
  () => "2026-08-14T00:00:00.000Z"
);

const expected = [
  {
    course_id: "course-1",
    tutor_id: "tutor-1",
    external_id: "cw-9",
    title: "Quadratics worksheet",
    description: "Do the odd ones",
    materials: [{ title: "Sheet", link: "https://x/y" }],
    due_date: "2026-09-01",
    max_points: 20,
    template_url: "https://classroom/cw-9",
    topic_id: "unit-2",
    topic_name: "Quadratics",
    updated_at: "2026-08-14T00:00:00.000Z",
  },
  {
    course_id: "course-1",
    tutor_id: "tutor-1",
    external_id: "cw-10",
    title: "Reading",
    description: null,
    materials: [],
    due_date: null,
    max_points: null,
    template_url: null,
    topic_id: null,
    topic_name: null,
    updated_at: "2026-08-14T00:00:00.000Z",
  },
];

if (JSON.stringify(rows) !== JSON.stringify(expected)) {
  console.error("FAIL  Classroom upsert rows", { rows, expected });
  process.exit(1);
}
console.log("ok    Classroom courseWork maps to native assignment rows with external_id and topic");
