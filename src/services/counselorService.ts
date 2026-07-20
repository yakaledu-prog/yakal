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
  upcomingDeadlines: { school: string; student: string; deadline: string }[];
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
      .select("school_name, deadline, student_id")
      .in("student_id", studentIds)
      .not("deadline", "is", null)
      .order("deadline", { ascending: true })
      .limit(8),
  ]);

  const nameById = new Map(students.map((s) => [s.id, s.full_name]));
  const upcomingDeadlines = (schools || [])
    .filter((s) => s.deadline)
    .map((s) => ({
      school: s.school_name,
      student: nameById.get(s.student_id) || "Student",
      deadline: s.deadline as string,
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
