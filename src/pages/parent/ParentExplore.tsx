import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { getLinkedChildren } from "@/services/parentService";
import { StudentExploreUniversities } from "@/pages/student/StudentExploreUniversities";

// ============================================================
// Browsing universities on behalf of a child.
//
// The same catalogue the student sees. Which child a college goes to is asked
// in the add dialog rather than at the top of the page: a parent comparing
// schools has not decided who it is for yet, and making them say so before
// they can look put the question in the wrong order. It also means one look
// through the catalogue can serve two children.
//
// No frame around it. The page brings its own header and filter rail, and
// wrapping it in another banner with another child picker gave it two of both.
// ============================================================

export function ParentExplore() {
  const { user } = useAuth();

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  return (
    <StudentExploreUniversities
      targets={children.map((c) => ({
        id: c.id,
        name: c.full_name,
        avatarUrl: c.avatar_url,
        subtitle: c.grade_level ?? "Grade not set",
      }))}
    />
  );
}
