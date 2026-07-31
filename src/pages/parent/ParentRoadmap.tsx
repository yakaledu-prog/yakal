import { StudentRoadmap } from "@/pages/student/StudentRoadmap";
import { ChildViewFrame } from "@/components/shared/ChildViewFrame";

// ============================================================
// The parent's view of a child's college roadmap.
//
// Previously a fork of the student page that read and, worse, wrote against
// the parent's own id: the autosave in the header created a college
// application row on the parent's account every time the page was opened.
//
// It is now the student's roadmap rendered against the child, read only. The
// timeline needs the child's grade level to know which year to highlight, so
// the frame passes it down rather than letting it fall back to the signed-in
// profile.
// ============================================================

export function ParentRoadmap() {
  return (
    <ChildViewFrame
      title="College roadmap"
      subtitle="Where your child is up to, and what comes next."
      requiresService="admissions"
    >
      {(child) => (
        <StudentRoadmap
          studentId={child.id}
          gradeLevel={child.gradeLevel}
          embedded
          canEdit={false}
        />
      )}
    </ChildViewFrame>
  );
}
