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

// Students assigned to this counselor (via college_guide_applications.counselor_id).
export async function getCounselorStudents(counselorId: string): Promise<CounselorStudent[]> {
  const { data: apps, error } = await supabase
    .from("college_guide_applications")
    .select("id, student_id, stage, program_interest")
    .eq("counselor_id", counselorId);
  if (error || !apps || apps.length === 0) return [];

  const studentIds = apps.map((a) => a.student_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, grade_level")
    .in("id", studentIds);

  return apps.map((a) => {
    const p = profiles?.find((x) => x.id === a.student_id);
    return {
      id: a.student_id,
      full_name: p?.full_name || "Student",
      avatar_url: p?.avatar_url ?? null,
      email: p?.email ?? null,
      grade_level: p?.grade_level ?? null,
      stage: (a.stage as AppStage) ?? null,
      program_interest: a.program_interest ?? null,
      application_id: a.id,
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
    .eq("counselor_id", counselorId)
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
