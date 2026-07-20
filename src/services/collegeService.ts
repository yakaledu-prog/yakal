import { supabase } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────
export type AppStage = "research" | "apply" | "submitted" | "decisions" | "enrolled";
export type SchoolTier = "dream" | "target" | "safety";
export type SchoolStatus = "considering" | "applying" | "submitted" | "accepted" | "rejected" | "denied" | "waitlisted" | "enrolled";
export type EssayKind = "personal_statement" | "supplement";
export type EssayStatus = "todo" | "drafting" | "in_review" | "done";
export type RecStatus = "requested" | "received" | "submitted";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface CollegeApplication {
  id: string;
  student_id: string;
  counselor_id: string | null;
  program_interest: string | null;
  personal_statement: string | null;
  documents: unknown | null;
  status: string;
  counselor_notes: string | null;
  stage: AppStage;
  grad_year: number | null;
  submitted_at: string;
  updated_at: string;
}

export interface CollegeListItem {
  id: string;
  student_id: string;
  school_name: string;
  tier: SchoolTier;
  deadline: string | null;
  status: SchoolStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  requirements?: ApplicationRequirement[];
}

export interface ApplicationRequirement {
  id: string;
  college_list_item_id: string;
  label: string;
  is_complete: boolean;
  due_date: string | null;
}

export interface Essay {
  id: string;
  student_id: string;
  title: string;
  kind: EssayKind;
  college_list_item_id: string | null;
  status: EssayStatus;
  content: string | null;
  drive_url: string | null;
  due_date: string | null;
  updated_at: string;
}

export interface StudentAcademics {
  id: string;
  student_id: string;
  gpa: number | null;
  gpa_scale: number | null;
  sat_score: number | null;
  act_score: number | null;
  toefl_score: number | null;
  ap_courses: string[] | null;
}

export interface Recommendation {
  id: string;
  student_id: string;
  recommender_name: string;
  recommender_email: string | null;
  relationship: string | null;
  status: RecStatus;
  notes: string | null;
}

export interface ApplicationTask {
  id: string;
  student_id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
}

export interface CollegeProfile {
  application: CollegeApplication | null;
  schools: CollegeListItem[];
  essays: Essay[];
  academics: StudentAcademics | null;
  recommendations: Recommendation[];
  tasks: ApplicationTask[];
}

type Result<T = unknown> = { success: boolean; data?: T; error?: string };

async function write<T>(promise: any): Promise<Result<T>> {
  const { data, error } = await promise;
  if (error) {
    console.error("collegeService write failed:", error);
    return { success: false, error: error.message };
  }
  return { success: true, data: data as T };
}

// ─── Top-level application record ───────────────────────────
export async function getApplication(studentId: string): Promise<CollegeApplication | null> {
  const { data } = await supabase
    .from("college_guide_applications")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  return (data as CollegeApplication) ?? null;
}

export async function upsertApplication(
  studentId: string,
  patch: Partial<CollegeApplication>
): Promise<Result<CollegeApplication>> {
  const existing = await getApplication(studentId);
  if (existing) {
    return write(
      supabase.from("college_guide_applications").update(patch).eq("id", existing.id).select().single()
    );
  }
  return write(
    supabase.from("college_guide_applications").insert([{ student_id: studentId, ...patch }]).select().single()
  );
}

// ─── Aggregate load for a student's whole college profile ──
export async function getCollegeProfile(studentId: string): Promise<CollegeProfile> {
  const [application, schoolsRes, essaysRes, academicsRes, recsRes, tasksRes] = await Promise.all([
    getApplication(studentId),
    supabase.from("college_list_items").select("*").eq("student_id", studentId).order("tier"),
    supabase.from("essays").select("*").eq("student_id", studentId).order("created_at"),
    supabase.from("student_academics").select("*").eq("student_id", studentId).maybeSingle(),
    supabase.from("recommendations").select("*").eq("student_id", studentId).order("created_at"),
    supabase.from("application_tasks").select("*").eq("student_id", studentId).order("created_at"),
  ]);

  const schools = (schoolsRes.data as CollegeListItem[]) || [];
  if (schools.length > 0) {
    const ids = schools.map((s) => s.id);
    const { data: reqs } = await supabase
      .from("application_requirements")
      .select("*")
      .in("college_list_item_id", ids);
    const byItem = new Map<string, ApplicationRequirement[]>();
    (reqs as ApplicationRequirement[] || []).forEach((r) => {
      const list = byItem.get(r.college_list_item_id) || [];
      list.push(r);
      byItem.set(r.college_list_item_id, list);
    });
    schools.forEach((s) => (s.requirements = byItem.get(s.id) || []));
  }

  return {
    application,
    schools,
    essays: (essaysRes.data as Essay[]) || [],
    academics: (academicsRes.data as StudentAcademics) ?? null,
    recommendations: (recsRes.data as Recommendation[]) || [],
    tasks: (tasksRes.data as ApplicationTask[]) || [],
  };
}

// ─── College list items ─────────────────────────────────────
export const addSchool = (studentId: string, patch: Partial<CollegeListItem>) =>
  write<CollegeListItem>(
    supabase.from("college_list_items").insert([{ student_id: studentId, ...patch }]).select().single()
  );

export const updateSchool = (id: string, patch: Partial<CollegeListItem>) =>
  write<CollegeListItem>(supabase.from("college_list_items").update(patch).eq("id", id).select().single());

export const deleteSchool = (id: string) =>
  write(supabase.from("college_list_items").delete().eq("id", id));

// ─── Requirements ───────────────────────────────────────────
export const addRequirement = (itemId: string, label: string, dueDate?: string | null) =>
  write<ApplicationRequirement>(
    supabase.from("application_requirements").insert([{ college_list_item_id: itemId, label, due_date: dueDate ?? null }]).select().single()
  );

export const toggleRequirement = (id: string, isComplete: boolean) =>
  write(supabase.from("application_requirements").update({ is_complete: isComplete }).eq("id", id));

export const deleteRequirement = (id: string) =>
  write(supabase.from("application_requirements").delete().eq("id", id));

// ─── Essays ─────────────────────────────────────────────────
export const addEssay = (studentId: string, patch: Partial<Essay>) =>
  write<Essay>(supabase.from("essays").insert([{ student_id: studentId, ...patch }]).select().single());

export const updateEssay = (id: string, patch: Partial<Essay>) =>
  write<Essay>(supabase.from("essays").update(patch).eq("id", id).select().single());

export const deleteEssay = (id: string) =>
  write(supabase.from("essays").delete().eq("id", id));

// ─── Academics ──────────────────────────────────────────────
export async function upsertAcademics(
  studentId: string,
  patch: Partial<StudentAcademics>
): Promise<Result<StudentAcademics>> {
  const { data: existing } = await supabase
    .from("student_academics")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) {
    return write(supabase.from("student_academics").update(patch).eq("id", existing.id).select().single());
  }
  return write(supabase.from("student_academics").insert([{ student_id: studentId, ...patch }]).select().single());
}

// ─── Recommendations ────────────────────────────────────────
export const addRecommendation = (studentId: string, patch: Partial<Recommendation>) =>
  write<Recommendation>(
    supabase.from("recommendations").insert([{ student_id: studentId, ...patch }]).select().single()
  );

export const updateRecommendation = (id: string, patch: Partial<Recommendation>) =>
  write<Recommendation>(supabase.from("recommendations").update(patch).eq("id", id).select().single());

export const deleteRecommendation = (id: string) =>
  write(supabase.from("recommendations").delete().eq("id", id));

// ─── Tasks ──────────────────────────────────────────────────
export const addTask = (studentId: string, patch: Partial<ApplicationTask>) =>
  write<ApplicationTask>(
    supabase.from("application_tasks").insert([{ student_id: studentId, ...patch }]).select().single()
  );

export const updateTask = (id: string, patch: Partial<ApplicationTask>) =>
  write<ApplicationTask>(supabase.from("application_tasks").update(patch).eq("id", id).select().single());

export const deleteTask = (id: string) =>
  write(supabase.from("application_tasks").delete().eq("id", id));
