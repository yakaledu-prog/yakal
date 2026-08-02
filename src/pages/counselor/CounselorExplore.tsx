import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { getCounselorStudents } from "@/services/counselorService";
import { StudentExploreUniversities } from "@/pages/student/StudentExploreUniversities";

// ============================================================
// Browsing universities on behalf of a student.
//
// The page used to add whatever a counselor found to the counselor's own
// college list, which nobody ever looks at. It asks who a college is for in
// the add dialog now, the same way the parent's does, and more than one
// student can be picked: a school worth a look for one applicant is usually
// worth a look for several.
// ============================================================

export function CounselorExplore() {
  const { user } = useAuth();

  const { data: students = [] } = useQuery({
    queryKey: ["counselor-students", user?.id],
    queryFn: () => getCounselorStudents(user!.id),
    enabled: !!user?.id,
  });

  return (
    <StudentExploreUniversities
      targets={students.map((s) => ({
        id: s.id,
        name: s.full_name,
        avatarUrl: s.avatar_url,
        subtitle: s.grade_level ?? "Grade not set",
      }))}
    />
  );
}
