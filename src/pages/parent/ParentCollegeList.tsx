import { StudentCollegeList } from "@/pages/student/StudentCollegeList";
import { ChildViewFrame } from "@/components/shared/ChildViewFrame";

// ============================================================
// The parent's view of a child's college list.
//
// This page used to be a fork of an older student list: it queried the
// parent's own id, so it showed an empty list to every parent, and it carried
// an Add School form and a hardcoded MOCK_STATS table of GPA and sticker
// prices for four American universities.
//
// It is now the student's own list rendered against the child's id, read only.
// One list, so a change to how a college row looks lands on both sides at
// once, and the figures come from the catalog rather than a table somebody has
// to remember to update.
// ============================================================

export function ParentCollegeList() {
  return (
    <ChildViewFrame
      title="College list"
      subtitle="Every college your child is considering, with deadlines and costs."
      requiresService="admissions"
    >
      {(child) => <StudentCollegeList studentId={child.id} embedded canEdit={false} />}
    </ChildViewFrame>
  );
}
