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

// --- Per-child service enrollment (Tutoring / Admissions) ---
export type ServiceName = "tutoring" | "admissions";

export interface ChildService {
  id: string;
  student_id: string;
  service: ServiceName;
  is_active: boolean;
}

/**
 * The services active for the signed-in student.
 *
 * A student can read their own rows (child_services_student_select), so this
 * works without going through the parent. A service with no row at all counts
 * as inactive: nothing is unlocked until a parent turns it on.
 */
export async function getMyActiveServices(studentId: string): Promise<ServiceName[]> {
  const { data, error } = await supabase
    .from("child_services")
    .select("service, is_active")
    .eq("student_id", studentId)
    .eq("is_active", true);
  if (error) {
    console.warn("Could not read services", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.service as ServiceName);
}

export async function getChildServices(childIds: string[]): Promise<ChildService[]> {
  if (childIds.length === 0) return [];
  const { data } = await supabase
    .from("child_services")
    .select("id, student_id, service, is_active")
    .in("student_id", childIds);
  return (data as ChildService[]) || [];
}

// Toggle a service on/off for a child (upsert on the unique (student_id, service)).
export async function setChildService(
  studentId: string,
  service: ServiceName,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("child_services")
    .upsert({ student_id: studentId, service, is_active: isActive }, { onConflict: "student_id,service" });
  if (error) {
    console.error("setChildService failed:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
