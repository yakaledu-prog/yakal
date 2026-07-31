import { delay } from "@/mock";

export type DiagnosticResult = {
  id: string; // e.g. "algebra"
  studentId: string;
  score: number;
  total: number;
  completedAt: string;
};

// Store in local storage to persist across reloads in the browser for this MVP
const STORAGE_KEY = "yakal_diagnostic_results";

const getResults = (): DiagnosticResult[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveResults = (results: DiagnosticResult[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch (e) {
    console.error("Failed to save diagnostics", e);
  }
};

export const diagnosticService = {
  async getStudentResults(studentId: string): Promise<DiagnosticResult[]> {
    await delay(300);
    const results = getResults();
    return results.filter((r) => r.studentId === studentId);
  },

  async saveResult(studentId: string, testId: string, score: number, total: number): Promise<void> {
    await delay(300);
    const results = getResults();
    const newResult: DiagnosticResult = {
      id: testId,
      studentId,
      score,
      total,
      completedAt: new Date().toISOString(),
    };
    
    // Check if replacing an existing one or adding a new one
    const existingIndex = results.findIndex(r => r.studentId === studentId && r.id === testId);
    if (existingIndex >= 0) {
      results[existingIndex] = newResult;
    } else {
      results.push(newResult);
    }
    
    saveResults(results);
  }
};
