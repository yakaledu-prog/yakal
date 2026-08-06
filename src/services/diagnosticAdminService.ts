import { supabase } from "@/lib/supabase";
import type { DiagnosticQuestion, DiagnosticTest } from "@/data/diagnostics";

/**
 * Diagnostics an admin writes, in the shape the student page already reads.
 *
 * The row is a `DiagnosticTest` with a few columns beside it. Questions live
 * in one jsonb column, so a test can be pasted whole, which is the point: the
 * questions are generated elsewhere and arrive as JSON.
 */
export interface DiagnosticRow extends DiagnosticTest {
  /** The database id. `id` on DiagnosticTest is the slug the results key by. */
  rowId: string;
  courseId: string | null;
  published: boolean;
  sortOrder: number;
  updatedAt: string;
}

type Result<T = void> = { success: boolean; error?: string; data?: T };

function toTest(r: any): DiagnosticRow {
  return {
    rowId: r.id,
    id: r.slug,
    title: r.title,
    description: r.description ?? "",
    categoryId: r.category_id,
    categoryName: r.category_name,
    timeLimitMinutes: r.time_limit_minutes ?? undefined,
    questions: (r.questions ?? []) as DiagnosticQuestion[],
    courseId: r.course_id,
    published: r.published,
    sortOrder: r.sort_order,
    updatedAt: r.updated_at,
  };
}

/**
 * Check a pasted question list, and say what is wrong in words.
 *
 * Written to be read by whoever pasted it, not by a developer. "Question 3 has
 * no correct answer marked" sends somebody to the right line; a schema
 * validator's path expression does not. The index is 1-based for the same
 * reason.
 */
export function validateQuestions(value: unknown): { ok: true; questions: DiagnosticQuestion[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "The questions must be a list, wrapped in [ ]." };
  }
  if (value.length === 0) {
    return { ok: false, error: "There are no questions in there." };
  }

  const questions: DiagnosticQuestion[] = [];
  for (let i = 0; i < value.length; i++) {
    const q = value[i] as Record<string, unknown>;
    const at = `Question ${i + 1}`;
    if (!q || typeof q !== "object") return { ok: false, error: `${at} is not an object.` };
    if (typeof q.text !== "string" || !q.text.trim()) {
      return { ok: false, error: `${at} has no text.` };
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { ok: false, error: `${at} needs at least two options.` };
    }
    if (q.options.some((o) => typeof o !== "string" || !o.trim())) {
      return { ok: false, error: `${at} has an empty option.` };
    }
    if (typeof q.correctAnswer !== "number" || !Number.isInteger(q.correctAnswer)) {
      return { ok: false, error: `${at} has no correct answer marked. Use correctAnswer, counting from 0.` };
    }
    if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
      return {
        ok: false,
        error: `${at} marks option ${q.correctAnswer} as correct, but it only has ${q.options.length}. They count from 0.`,
      };
    }
    questions.push({
      // Ids only have to be unique inside one test, and a pasted list rarely
      // carries them, so they are filled in rather than demanded.
      id: typeof q.id === "string" && q.id.trim() ? q.id : `q${i + 1}`,
      text: String(q.text).trim(),
      options: (q.options as string[]).map((o) => o.trim()),
      correctAnswer: q.correctAnswer,
      explanation: typeof q.explanation === "string" && q.explanation.trim() ? q.explanation.trim() : undefined,
    });
  }
  return { ok: true, questions };
}

/** Parse and validate in one step, so the dialog has a single failure path. */
export function parseQuestionsJson(text: string): { ok: true; questions: DiagnosticQuestion[] } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Nothing to read." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e: any) {
    // JSON.parse says "Unexpected token } in JSON at position 214", which is
    // more useful than it looks once you know it counts characters.
    return { ok: false, error: `That is not valid JSON. ${e.message}` };
  }
  // Tolerate a whole test being pasted, not just its questions. Somebody
  // copying from src/data/diagnostics.ts will bring the wrapper with it.
  const list = Array.isArray(parsed) ? parsed : (parsed as any)?.questions;
  return validateQuestions(list);
}

/** An empty test, shown in the JSON view so there is something to fill in. */
export const QUESTION_TEMPLATE = JSON.stringify(
  [
    {
      id: "q1",
      text: "What is 15% of 200?",
      options: ["15", "20", "30", "45"],
      correctAnswer: 2,
      explanation: "0.15 * 200 = 30",
    },
  ],
  null,
  2
);

/**
 * The tests a student may sit, preferring the database over the built-in file.
 *
 * src/data/diagnostics.ts is the fallback rather than dead weight: a fresh
 * database has no rows, and a student landing on an empty assessment straight
 * after onboarding is a worse first impression than the tests that shipped.
 */
export async function getPublishedDiagnostics(): Promise<DiagnosticTest[] | null> {
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("published", true)
    .order("category_name", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getPublishedDiagnostics:", error.message);
    return null;
  }
  // Null, not an empty list. "Nothing published" and "could not ask" both mean
  // fall back, and the caller should not have to tell them apart.
  return data && data.length > 0 ? data.map(toTest) : null;
}

export async function getDiagnostics(): Promise<DiagnosticRow[]> {
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .order("category_name", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getDiagnostics:", error.message);
    return [];
  }
  return (data ?? []).map(toTest);
}

export interface DiagnosticInput {
  slug: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  timeLimitMinutes: number | null;
  questions: DiagnosticQuestion[];
  courseId: string | null;
  published: boolean;
}

function toRow(input: DiagnosticInput) {
  return {
    slug: input.slug.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    category_id: input.categoryId.trim(),
    category_name: input.categoryName.trim(),
    time_limit_minutes: input.timeLimitMinutes,
    questions: input.questions,
    course_id: input.courseId,
    published: input.published,
  };
}

export async function createDiagnostic(input: DiagnosticInput): Promise<Result<string>> {
  const { data, error } = await supabase.from("diagnostics").insert(toRow(input)).select("id").single();
  if (error) {
    if (error.code === "23505") return { success: false, error: `The id "${input.slug}" is already taken.` };
    return { success: false, error: error.message };
  }
  return { success: true, data: data.id };
}

export async function updateDiagnostic(rowId: string, input: DiagnosticInput): Promise<Result> {
  const { error } = await supabase.from("diagnostics").update(toRow(input)).eq("id", rowId);
  if (error) {
    if (error.code === "23505") return { success: false, error: `The id "${input.slug}" is already taken.` };
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteDiagnostic(rowId: string): Promise<Result> {
  const { error } = await supabase.from("diagnostics").delete().eq("id", rowId);
  return error ? { success: false, error: error.message } : { success: true };
}
