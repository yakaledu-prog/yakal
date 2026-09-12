import { supabase } from "@/lib/supabase";
import type { AppStage } from "./collegeService";

export interface CounselorStudent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  grade_level: string | null;
  stage: AppStage | null;
  program_interest: string | null;
  application_id: string | null;
}

export interface CounselorDashboard {
  students: CounselorStudent[];
  totalStudents: number;
  essaysInReview: number;
  upcomingDeadlines: { id: string; school: string; student: string; studentAvatar: string | null; deadline: string; image: string | null; requirements: { label: string; is_complete: boolean }[] }[];
}

/**
 * The families this counsellor is working with.
 *
 * Driven by the plan rather than the application. The plan is the engagement
 * somebody paid for; the application is a workspace that may hold nothing yet.
 * Reading the application first meant a family who had bought a tier but not
 * yet saved a college list was invisible to the person meant to be advising
 * them.
 */
export async function getCounselorStudents(counselorId: string): Promise<CounselorStudent[]> {
  const { data: plans, error } = await supabase
    .from("admissions_plans")
    .select("student_id")
    .eq("counselor_id", counselorId)
    .in("status", ["active", "past_due"]);
  if (error) {
    console.error("getCounselorStudents:", error.message);
    return [];
  }
  const studentIds = [...new Set((plans ?? []).map((p) => p.student_id))];
  if (studentIds.length === 0) return [];

  const [{ data: profiles }, { data: apps }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email, grade_level")
      .in("id", studentIds),
    supabase
      .from("college_guide_applications")
      .select("id, student_id, stage, program_interest")
      .in("student_id", studentIds),
  ]);

  const appByStudent = new Map((apps ?? []).map((a) => [a.student_id, a]));

  return studentIds.map((studentId) => {
    const p = profiles?.find((x) => x.id === studentId);
    const a = appByStudent.get(studentId);
    return {
      id: studentId,
      full_name: p?.full_name || "Student",
      avatar_url: p?.avatar_url ?? null,
      email: p?.email ?? null,
      grade_level: p?.grade_level ?? null,
      stage: (a?.stage as AppStage) ?? null,
      program_interest: a?.program_interest ?? null,
      application_id: a?.id ?? null,
    };
  });
}

export async function getCounselorDashboard(counselorId: string): Promise<CounselorDashboard> {
  const students = await getCounselorStudents(counselorId);
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return { students, totalStudents: 0, essaysInReview: 0, upcomingDeadlines: [] };
  }

  const [{ count: essaysInReview }, { data: schools }] = await Promise.all([
    supabase
      .from("essays")
      .select("id", { count: "exact", head: true })
      .in("student_id", studentIds)
      .eq("status", "in_review"),
    supabase
      .from("college_list_items")
      .select("id, school_name, deadline, student_id, unitid")
      .in("student_id", studentIds)
      .not("deadline", "is", null)
      .order("deadline", { ascending: true })
      .limit(8),
  ]);

  const schoolIds = schools?.map((s) => s.id) || [];
  const unitIds = schools?.map((s) => s.unitid).filter(Boolean) || [];

  const [{ data: reqs }, { data: catalogs }] = await Promise.all([
    schoolIds.length > 0 
      ? supabase.from("application_requirements").select("college_list_item_id, label, is_complete").in("college_list_item_id", schoolIds)
      : Promise.resolve({ data: [] }),
    unitIds.length > 0
      ? supabase.from("college_catalog").select("unitid, image").in("unitid", unitIds)
      : Promise.resolve({ data: [] })
  ]);

  const reqBySchool = new Map<string, { label: string; is_complete: boolean }[]>();
  reqs?.forEach(r => {
    if (!reqBySchool.has(r.college_list_item_id)) {
      reqBySchool.set(r.college_list_item_id, []);
    }
    reqBySchool.get(r.college_list_item_id)!.push({ label: r.label, is_complete: r.is_complete });
  });

  const imageByUnitId = new Map<number, string | null>();
  catalogs?.forEach(c => {
    imageByUnitId.set(c.unitid, c.image);
  });

  const nameById = new Map(students.map((s) => [s.id, s.full_name]));
  const avatarById = new Map(students.map((s) => [s.id, s.avatar_url]));
  
  const upcomingDeadlines = (schools || [])
    .filter((s) => s.deadline)
    .map((s) => ({
      id: s.id,
      school: s.school_name,
      student: nameById.get(s.student_id) || "Student",
      studentAvatar: avatarById.get(s.student_id) || null,
      deadline: s.deadline as string,
      image: s.unitid ? imageByUnitId.get(s.unitid) || null : null,
      requirements: reqBySchool.get(s.id) || [],
    }));

  return {
    students,
    totalStudents: students.length,
    essaysInReview: essaysInReview || 0,
    upcomingDeadlines,
  };
}

// Basic profile lookup for the student-detail header.
export async function getStudentProfile(studentId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, grade_level, bio")
    .eq("id", studentId)
    .single();
  return data;
}

export interface SessionRow {
  id: string;
  tutor_id: string;
  counselor_id?: string;
  student_id: string;
  subject: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  meeting_link?: string;
  zoom_meeting_id?: string;
  zoom_link?: string;
  notes?: string;
  student_name?: string;
  student_avatar?: string;
  course_id?: string;
}

export async function getCounselorSessionsFull(counselorId: string): Promise<SessionRow[]> {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    // Advising sessions store the counsellor in tutor_id; the sessions table
    // has no counselor_id column, so the old filter matched nothing and the
    // calendar came back empty. Restrict to counselling kinds so a tutoring
    // lesson never shows up in a counsellor's list.
    .eq("tutor_id", counselorId)
    .in("kind", ["advising", "mock_interview"])
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error || !sessions) return [];
  if (sessions.length === 0) return sessions as SessionRow[];

  const studentIds = [...new Set(sessions.map((s: any) => s.student_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", studentIds);

  return sessions.map((s: any) => {
    const p = profiles?.find((x) => x.id === s.student_id);
    return { ...s, student_name: p?.full_name || "Student", student_avatar: p?.avatar_url };
  }) as SessionRow[];
}

export async function completeSession(id: string, notes?: string) {
  const patch: Record<string, unknown> = { status: "completed" };
  if (notes !== undefined) patch.notes = notes;
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  return !error;
}

export async function saveSessionNotes(id: string, notes: string) {
  const { error } = await supabase.from("sessions").update({ notes }).eq("id", id);
  return !error;
}

export async function cancelSession(id: string) {
  const { error } = await supabase.from("sessions").update({ status: "cancelled" }).eq("id", id);
  return !error;
}

/**
 * One session, with the student on it.
 *
 * The detail page used to render a fixed mock: "AP Calculus AB", "Today at
 * 4:00 PM", a counselor called Dr. Alex. It never read its own route
 * parameter, so every session opened the same invented one.
 */
export async function getSessionById(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;

  const { data: student } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", data.student_id)
    .maybeSingle();

  return {
    ...(data as SessionRow),
    student_name: student?.full_name ?? "Student",
    student_avatar: student?.avatar_url ?? undefined,
  };
}
