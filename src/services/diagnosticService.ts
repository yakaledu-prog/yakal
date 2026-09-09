import { supabase } from "@/lib/supabase";

/** One question's outcome, kept so a student can review what they got wrong. */
export type DiagnosticAnswer = {
  questionId: string;
  /** The option index the student chose. -1 if they somehow left it blank. */
  chosen: number;
  /** The option index that was correct. */
  correct: number;
  /**
   * Why, as it was worded when they sat it.
   *
   * Stored on the result rather than read from the diagnostic, because the
   * diagnostic no longer reaches the browser with its answers in it, and
   * because rewording a question next term must not change what somebody was
   * shown last term.
   */
  explanation?: string | null;
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

/** A question as a student is allowed to see it: no correct index, no explanation. */
export type StudentDiagnosticQuestion = {
  id: string;
  text: string;
  options: string[];
};

/** A diagnostic as a student is allowed to see it. */
export type StudentDiagnostic = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  timeLimitMinutes?: number;
  courseId: string | null;
  questions: StudentDiagnosticQuestion[];
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
        explanation: a.explanation ?? null,
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
   * Every diagnostic a student may sit, without the answers.
   *
   * Through student_diagnostics() rather than the table, because the table's
   * questions column carries correctAnswer and used to be readable by anon.
   * The function strips the correct index and the explanation, both of which
   * give the answer away, and both of which come back afterwards from the
   * stored result rather than from the diagnostic.
   */
  async listForStudent(): Promise<StudentDiagnostic[]> {
    const { data, error } = await supabase.rpc("student_diagnostics");
    if (error) {
      console.error("listForStudent:", error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.slug,
      title: r.title,
      description: r.description ?? "",
      categoryId: r.category_id,
      categoryName: r.category_name,
      timeLimitMinutes: r.time_limit_minutes ?? undefined,
      courseId: r.course_id ?? null,
      questions: (r.questions ?? []) as StudentDiagnosticQuestion[],
    }));
  },

  /**
   * Record a completed sitting.
   *
   * The browser sends what was chosen and nothing else. It used to compare
   * chosen to correct itself and insert the score it had worked out, with
   * authenticated holding INSERT on the table, so a student could post any
   * score against themselves without going near the UI. submit_diagnostic
   * marks it against the stored key and is the only way in.
   */
  async saveResult(
    slug: string,
    answers: { questionId: string; chosen: number }[]
  ): Promise<{ ok: true; score: number; total: number } | { ok: false; error: string }> {
    const { data, error } = await supabase.rpc("submit_diagnostic", {
      p_slug: slug,
      p_answers: answers.map((a) => ({ question_id: a.questionId, chosen: a.chosen })),
    });

    if (error) {
      console.error("saveResult:", error.message);
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, score: row?.score ?? 0, total: row?.total ?? answers.length };
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
