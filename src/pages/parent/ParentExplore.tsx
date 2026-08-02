import { ChildViewFrame } from "@/components/shared/ChildViewFrame";
import { StudentExploreUniversities } from "@/pages/student/StudentExploreUniversities";

// ============================================================
// Browsing universities on behalf of a child.
//
// The same catalogue the student sees, pointed at their list rather than the
// parent's. Anything added records the parent as the one who added it, so a
// student opening their list to find a college they have not heard of can see
// where it came from.
//
// A page of its own rather than a tab on the child's record: it carries its
// own filter rail and header, and nesting that under two rows of tabs made
// the thing you came to read the third row down. The frame's banner is off
// for the same reason - the page already opens with one.
// ============================================================

export function ParentExplore() {
  return (
    <ChildViewFrame chrome={false} requiresService="admissions">
      {(child) => (
        <StudentExploreUniversities
          studentId={child.id}
          studentName={child.name.split(" ")[0]}
        />
      )}
    </ChildViewFrame>
  );
}
