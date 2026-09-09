// Turning stored diagnostic results into the numbers a report draws.
//
// Pure functions, no database and no React, so they can be unit tested on their
// own (scripts/verify/diagnostic-report.ts) and shared between the tutor view,
// which reports on one student, and the admin view, which reports across all of
// them. The service does the fetching; this does the arithmetic.

import type { DiagnosticResult } from "./diagnosticService";
import type { DiagnosticTest } from "@/data/diagnostics";

export type CategoryStat = {
  category: string;
  correct: number;
  total: number;
  /** Rounded percentage, 0 when nothing has been answered. */
  accuracy: number;
};

export type TestStat = {
  slug: string;
  title: string;
  attempts: number;
  /** Mean of each sitting's percentage, rounded. */
  avgAccuracy: number;
};

function pct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/** Overall correct, total, and accuracy across a set of results. */
export function overall(results: DiagnosticResult[]): { correct: number; total: number; accuracy: number } {
  const correct = results.reduce((s, r) => s + r.score, 0);
  const total = results.reduce((s, r) => s + r.total, 0);
  return { correct, total, accuracy: pct(correct, total) };
}

/**
 * Accuracy grouped by the test's category, weakest first.
 *
 * A result carries only its slug, so the category comes from the tests list. A
 * result whose test is not in that list (a slug that was deleted, or a built-in
 * the caller did not pass) still counts, under "Other", rather than vanishing.
 * Weakest first because the point of the report is where to spend the next hour.
 */
export function byCategory(results: DiagnosticResult[], tests: DiagnosticTest[]): CategoryStat[] {
  const categoryOf = new Map(tests.map((t) => [t.id, t.categoryName]));
  const acc = new Map<string, { correct: number; total: number }>();

  for (const r of results) {
    const category = categoryOf.get(r.id) ?? "Other";
    const cur = acc.get(category) ?? { correct: 0, total: 0 };
    cur.correct += r.score;
    cur.total += r.total;
    acc.set(category, cur);
  }

  return [...acc.entries()]
    .map(([category, v]) => ({ category, correct: v.correct, total: v.total, accuracy: pct(v.correct, v.total) }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Per test, how many times it was sat and the average score, lowest first.
 *
 * Averages each sitting's percentage rather than pooling raw counts, so a hard
 * test is not flattered by one keen student who answered many questions. Lowest
 * first surfaces the tests that are landing worst across everyone.
 */
export function perTest(results: DiagnosticResult[], tests: DiagnosticTest[]): TestStat[] {
  const titleOf = new Map(tests.map((t) => [t.id, t.title]));
  const acc = new Map<string, { attempts: number; sumPct: number }>();

  for (const r of results) {
    const cur = acc.get(r.id) ?? { attempts: 0, sumPct: 0 };
    cur.attempts += 1;
    cur.sumPct += r.total > 0 ? (r.score / r.total) * 100 : 0;
    acc.set(r.id, cur);
  }

  return [...acc.entries()]
    .map(([slug, v]) => ({
      slug,
      title: titleOf.get(slug) ?? slug,
      attempts: v.attempts,
      avgAccuracy: Math.round(v.sumPct / v.attempts),
    }))
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy);
}
