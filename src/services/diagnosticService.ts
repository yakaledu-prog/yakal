import { supabase } from "@/lib/supabase";

/** One question's outcome, kept so a student can review what they got wrong. */
export type DiagnosticAnswer = {
  questionId: string;
  /** The option index the student chose. -1 if they somehow left it blank. */
  chosen: number;
  /** The option index that was correct. */
  correct: number;
};

export type DiagnosticResult = {
  /** The diagnostic slug. Named `id` because callers key results by test id. */
  id: string;
  studentId: string;
  score: number;
  total: number;
  completedAt: string;
  answers: DiagnosticAnswer[];
};

/** One test's aggregate, from the admin stats function. */
export type DiagnosticTestStat = {
  slug: string;
  attempts: number;
  students: number;
  avgAccuracy: number;
};

/** The whole admin overview, aggregated in Postgres rather than the browser. */
export type DiagnosticStats = {
  overview: { attempts: number; students: number; correct: number; total: number };
  byTest: DiagnosticTestStat[];
};

// Rows come back with the answers column already parsed from jsonb. The db
// stores question_id (snake_case, as the migration documents); the app speaks
// questionId, so translate at the boundary rather than leaking column names up.
function fromRow(r: any): DiagnosticResult {
  const answers: DiagnosticAnswer[] = Array.isArray(r.answers)
    ? r.answers.map((a: any) => ({
        questionId: a.question_id,
        chosen: a.chosen,
        correct: a.correct,
      }))
    : [];
  return {
    id: r.diagnostic_slug,
    studentId: r.student_id,
    score: r.score,
    total: r.total,
    completedAt: r.completed_at,
    answers,
  };
}

export const diagnosticService = {
  /**
   * A student's results, one row per test: the latest attempt of each.
   *
   * Every sitting is stored, so retaking a test leaves the old row in place
   * (a "score over time" view will want them). The list is ordered newest
   * first and collapsed to the first sighting of each slug, so the caller gets
   * the current result per test without knowing attempts exist.
   *
   * Row-level security decides whose results these are: the student sees their
   * own, a tutor sees a student they teach, a linked parent their child, and so
   * on. This function just names the student; the database does the gating.
   */
  async getStudentResults(studentId: string): Promise<DiagnosticResult[]> {
    const { data, error } = await supabase
      .from("diagnostic_results")
      .select("*")
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("getStudentResults:", error.message);
      return [];
    }

    const seen = new Set<string>();
    const latest: DiagnosticResult[] = [];
    for (const row of data ?? []) {
      const result = fromRow(row);
      if (!seen.has(result.id)) {
        seen.add(result.id);
        latest.push(result);
      }
    }
    return latest;
  },

  /**
   * Every attempt a student has made, oldest first.
   *
   * getStudentResults collapses to the latest per test; this keeps them all, in
   * time order, for a progress-over-time view. It is a student's own rows only
   * (small, and RLS-scoped), so one query rather than one per test.
   */
  async getStudentAttempts(studentId: string): Promise<DiagnosticResult[]> {
    const { data, error } = await supabase
      .from("diagnostic_results")
      .select("*")
      .eq("student_id", studentId)
      .order("completed_at", { ascending: true });

    if (error) {
      console.error("getStudentAttempts:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  },

  /**
   * Record a completed sitting.
   *
   * Takes the per-question answers and derives the score from them, so the
   * stored score can never disagree with the stored answers. Returns the score
   * it computed on success, for the "you scored X of Y" message.
   */
  async saveResult(
    studentId: string,
    slug: string,
    answers: DiagnosticAnswer[]
  ): Promise<{ ok: true; score: number; total: number } | { ok: false; error: string }> {
    const total = answers.length;
    const score = answers.filter((a) => a.chosen === a.correct).length;

    const { error } = await supabase.from("diagnostic_results").insert({
      student_id: studentId,
      diagnostic_slug: slug,
      score,
      total,
      answers: answers.map((a) => ({
        question_id: a.questionId,
        chosen: a.chosen,
        correct: a.correct,
      })),
    });

    if (error) {
      console.error("saveResult:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, score, total };
  },

  /**
   * The admin overview, aggregated in Postgres.
   *
   * Calls the diagnostic_result_stats function, which folds every sitting into
   * a small summary server-side and is gated to admins there. The browser used
   * to fetch the whole history and aggregate it; this keeps the payload and the
   * work flat as the table grows.
   */
  async getResultStats(): Promise<DiagnosticStats | null> {
    const { data, error } = await supabase.rpc("diagnostic_result_stats");
    if (error) {
      console.error("getResultStats:", error.message);
      return null;
    }
    const raw = (data ?? {}) as any;
    return {
      overview: {
        attempts: raw.overview?.attempts ?? 0,
        students: raw.overview?.students ?? 0,
        correct: raw.overview?.correct ?? 0,
        total: raw.overview?.total ?? 0,
      },
      byTest: (raw.byTest ?? []).map((r: any) => ({
        slug: r.slug,
        attempts: r.attempts,
        students: r.students,
        avgAccuracy: r.avg_accuracy,
      })),
    };
  },
};
