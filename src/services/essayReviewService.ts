import { supabase } from "@/lib/supabase";
import { sendNotification } from "./notificationService";

// ============================================================
// A counselor's pass over an essay.
//
// The essay is written and commented on in Google Docs, so nothing here tries
// to be a text editor. What the portal owns is the fact that a pass happened:
// who did it, when, and which way it went. That single row is the audit trail,
// the student's history and the round counter at once.
//
// Returning or approving is what spends a round. Reopening does not, because a
// counselor undoing their own approval is a correction and a family should not
// pay for it.
//
// Nothing here checks a quota. See admissionsService for why.
// ============================================================

export type ReviewAction = "returned" | "approved" | "reopened";

export interface EssayReview {
  id: string;
  essayId: string;
  counselorId: string;
  counselorName: string | null;
  action: ReviewAction;
  note: string | null;
  createdAt: string;
}

/** The essay status each action leaves behind. */
const NEXT_STATUS: Record<ReviewAction, string> = {
  returned: "drafting",
  approved: "done",
  reopened: "in_review",
};

/**
 * Record a pass and move the essay.
 *
 * The log row is written first. If the status update then fails the count is
 * still right and the essay can be moved by hand, which is the better way
 * round: a lost round is a billing dispute, a stuck status is a click.
 */
export async function reviewEssay(input: {
  essayId: string;
  counselorId: string;
  action: ReviewAction;
  note?: string;
  /** Told so the student knows to look at the document. */
  studentId?: string;
  essayTitle?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error: logErr } = await supabase.from("essay_reviews").insert({
    essay_id: input.essayId,
    counselor_id: input.counselorId,
    action: input.action,
    note: input.note?.trim() || null,
  });
  if (logErr) return { success: false, error: logErr.message };

  const { error: essayErr } = await supabase
    .from("essays")
    .update({ status: NEXT_STATUS[input.action], updated_at: new Date().toISOString() })
    .eq("id", input.essayId);
  if (essayErr) return { success: false, error: essayErr.message };

  // Reopening is the counselor tidying up after themselves. Telling the
  // student their finished essay is unfinished again, with no new feedback, is
  // worse than saying nothing.
  if (input.studentId && input.action !== "reopened") {
    await sendNotification({
      userId: input.studentId,
      type: "essay_review",
      title: input.action === "approved" ? "An essay is finished" : "An essay came back",
      message:
        input.action === "approved"
          ? `${input.essayTitle ?? "Your essay"} has been approved.`
          : `${input.essayTitle ?? "Your essay"} has comments waiting in the document.`,
      // The student essays live on the application workspace at /student/my-app;
      // there is no /student/essays route, so the old link opened not-found.
      link: "/student/my-app",
    }).catch(() => undefined);
  }

  return { success: true };
}

/** Every pass over one essay, newest first. */
export async function getEssayReviews(essayId: string): Promise<EssayReview[]> {
  const { data, error } = await supabase
    .from("essay_reviews")
    .select(`id, essay_id, counselor_id, action, note, created_at,
             counselor:profiles!essay_reviews_counselor_id_fkey (full_name)`)
    .eq("essay_id", essayId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getEssayReviews failed:", error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    essayId: r.essay_id,
    counselorId: r.counselor_id,
    counselorName: r.counselor?.full_name ?? null,
    action: r.action,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export interface ReviewQueueItem {
  id: string;
  title: string;
  kind: string;
  status: string;
  driveUrl: string | null;
  dueDate: string | null;
  wordLimit: number | null;
  prompt: string | null;
  roundsUsed: number;
  updatedAt: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  collegeName: string | null;
}

/**
 * What is waiting on a counselor.
 *
 * Essays in review lead, because somebody is blocked on them. Everything else
 * a counselor's students are working on comes after, so the page is the state
 * of the work rather than only the inbox.
 */
export async function getReviewQueue(studentIds: string[]): Promise<ReviewQueueItem[]> {
  if (studentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("essays")
    .select(`id, title, kind, status, drive_url, due_date, word_limit, prompt,
             rounds_used, updated_at, student_id,
             student:profiles!essays_student_id_fkey (full_name, avatar_url),
             college:college_list_items (school_name)`)
    .in("student_id", studentIds)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getReviewQueue failed:", error);
    return [];
  }

  return (data ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    kind: e.kind,
    status: e.status,
    driveUrl: e.drive_url,
    dueDate: e.due_date,
    wordLimit: e.word_limit,
    prompt: e.prompt,
    roundsUsed: e.rounds_used ?? 0,
    updatedAt: e.updated_at,
    studentId: e.student_id,
    studentName: e.student?.full_name ?? "Student",
    studentAvatarUrl: e.student?.avatar_url ?? null,
    collegeName: e.college?.school_name ?? null,
  }));
}
