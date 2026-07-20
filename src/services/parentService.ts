import { supabase } from "@/lib/supabase";

export interface LinkedChild {
  id: string;
  full_name: string;
  avatar_url: string | null;
  grade_level: string | null;
}

// Active children linked to this parent.
export async function getLinkedChildren(parentId: string): Promise<LinkedChild[]> {
  const { data: links } = await supabase
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId)
    .eq("status", "active");
  const ids = (links || []).map((l) => l.student_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, grade_level")
    .in("id", ids)
    .order("full_name");
  return (profiles as LinkedChild[]) || [];
}
