import { supabase } from "@/lib/supabase";

// --- Types --------------------------------------------------
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
  /** IPEDS unit ID, set when the school came from the catalog. Null for
   *  manually added schools (foreign universities and very small colleges). */
  unitid?: number | null;
  deadline_round?: string | null;
  application_url?: string | null;
  supp_essay_count?: number | null;
  why_school?: string | null;
  /** Who typed the human-entered fields. */
  entered_by?: string | null;
  /** Counselor who confirmed them. Null means nobody has checked. */
  verified_by?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
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
  /** The college's actual question. Pasted by the student or curated per cycle. */
  prompt?: string | null;
  /** Colleges enforce these, so a draft is not done until it fits. */
  word_limit?: number | null;
  /** Feedback rounds spent. The tiers sell a fixed number of these. */
  rounds_used?: number | null;
  last_feedback_at?: string | null;
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
  /** Dates for each step, so "asked three weeks ago" is answerable. */
  asked_on?: string | null;
  invited_on?: string | null;
  submitted_on?: string | null;
  /** Waiving is near-universal: a letter the student can read carries less weight. */
  ferpa_waived?: boolean | null;
  thank_you_sent?: boolean | null;
  /** Exception path only. US letters go straight to Common App. */
  letter_url?: string | null;
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

// --- Top-level application record ---------------------------
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

// --- Aggregate load for a student's whole college profile --
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

// --- College list items -------------------------------------
export const addSchool = (studentId: string, patch: Partial<CollegeListItem>) =>
  write<CollegeListItem>(
    supabase.from("college_list_items").insert([{ student_id: studentId, ...patch }]).select().single()
  );

export type DeadlineRound = "ed1" | "ed2" | "ea" | "rea" | "rd" | "rolling";

export interface AddCollegeInput {
  unitid: number | null;
  school_name: string;
  tier: SchoolTier;
  deadline?: string | null;
  deadline_round?: DeadlineRound | null;
  application_url?: string | null;
  supp_essay_count?: number | null;
  why_school?: string | null;
}

/** Columns added by docs/db_migration_add_college_catalog.sql. */
const MIGRATION_COLUMNS = [
  "unitid",
  "deadline_round",
  "application_url",
  "supp_essay_count",
  "why_school",
  "entered_by",
];

/**
 * Add a college the student picked out of the catalog.
 *
 * Stores `unitid`, the IPEDS identifier, so the row references the catalog
 * instead of copying a name string. That is what stops the same college
 * existing twice with two different sticker prices.
 *
 * Also records `entered_by`, because these fields are typed by a student and
 * nothing has verified them yet. A counselor sets verified_by later.
 *
 * If the migration has not been applied, this retries with only the original
 * columns so the feature degrades instead of failing closed.
 */
export async function addSchoolFromCatalog(
  studentId: string,
  input: AddCollegeInput
): Promise<Result<CollegeListItem>> {
  const full: Record<string, unknown> = {
    student_id: studentId,
    school_name: input.school_name,
    tier: input.tier,
    deadline: input.deadline ?? null,
    unitid: input.unitid,
    deadline_round: input.deadline_round ?? null,
    application_url: input.application_url ?? null,
    supp_essay_count: input.supp_essay_count ?? null,
    why_school: input.why_school ?? null,
    entered_by: studentId,
  };

  const attempt = await write<CollegeListItem>(
    supabase.from("college_list_items").insert([full]).select().single()
  );
  if (attempt.success) return attempt;

  // PostgREST names the offending column, so only fall back when the failure is
  // actually a missing column and not, say, a permissions error.
  const err = attempt.error || "";
  if (!MIGRATION_COLUMNS.some((c) => err.includes(c))) return attempt;

  const legacy = {
    student_id: studentId,
    school_name: input.school_name,
    tier: input.tier,
    deadline: input.deadline ?? null,
    notes: input.why_school ?? null,
  };
  return write<CollegeListItem>(
    supabase.from("college_list_items").insert([legacy]).select().single()
  );
}

/**
 * A counselor confirms a student-entered deadline against the college's own
 * page.
 *
 * Stores the counselor's id rather than a boolean. A wrong deadline is
 * consequential, so we need to be able to answer who approved it and when.
 */
export const verifySchool = (
  id: string,
  counselorId: string,
  note?: string | null
) =>
  write<CollegeListItem>(
    supabase
      .from("college_list_items")
      .update({
        verified_by: counselorId,
        verified_at: new Date().toISOString(),
        verification_note: note ?? null,
      })
      .eq("id", id)
      .select()
      .single()
  );

export const updateSchool = (id: string, patch: Partial<CollegeListItem>) =>
  write<CollegeListItem>(supabase.from("college_list_items").update(patch).eq("id", id).select().single());

export const deleteSchool = (id: string) =>
  write(supabase.from("college_list_items").delete().eq("id", id));

// --- Requirements -------------------------------------------
export const addRequirement = (itemId: string, label: string, dueDate?: string | null) =>
  write<ApplicationRequirement>(
    supabase.from("application_requirements").insert([{ college_list_item_id: itemId, label, due_date: dueDate ?? null }]).select().single()
  );

export const toggleRequirement = (id: string, isComplete: boolean) =>
  write(supabase.from("application_requirements").update({ is_complete: isComplete }).eq("id", id));

export const deleteRequirement = (id: string) =>
  write(supabase.from("application_requirements").delete().eq("id", id));

// --- Essays -------------------------------------------------
export const addEssay = (studentId: string, patch: Partial<Essay>) =>
  write<Essay>(supabase.from("essays").insert([{ student_id: studentId, ...patch }]).select().single());

export const updateEssay = (id: string, patch: Partial<Essay>) =>
  write<Essay>(supabase.from("essays").update(patch).eq("id", id).select().single());

export const deleteEssay = (id: string) =>
  write(supabase.from("essays").delete().eq("id", id));

// --- Academics ----------------------------------------------
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

// --- Recommendations ----------------------------------------
export const addRecommendation = (studentId: string, patch: Partial<Recommendation>) =>
  write<Recommendation>(
    supabase.from("recommendations").insert([{ student_id: studentId, ...patch }]).select().single()
  );

export const updateRecommendation = (id: string, patch: Partial<Recommendation>) =>
  write<Recommendation>(supabase.from("recommendations").update(patch).eq("id", id).select().single());

export const deleteRecommendation = (id: string) =>
  write(supabase.from("recommendations").delete().eq("id", id));

// --- Tasks --------------------------------------------------
export const addTask = (studentId: string, patch: Partial<ApplicationTask>) =>
  write<ApplicationTask>(
    supabase.from("application_tasks").insert([{ student_id: studentId, ...patch }]).select().single()
  );

export const updateTask = (id: string, patch: Partial<ApplicationTask>) =>
  write<ApplicationTask>(supabase.from("application_tasks").update(patch).eq("id", id).select().single());

export const deleteTask = (id: string) =>
  write(supabase.from("application_tasks").delete().eq("id", id));
