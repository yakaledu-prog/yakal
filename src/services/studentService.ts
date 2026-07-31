import { MOCK_DASHBOARD_SUMMARY, delay } from "@/mock";

export const studentService = {
  /**
   * Student and parent home screen figures.
   *
   * Still mock data. Replacing it means querying sessions for the next booking,
   * assignments and submissions for what is due, and counting completed
   * sessions for the progress block. See src/mock/index.ts.
   */
  async getDashboardSummary() {
    await delay(600);
    return MOCK_DASHBOARD_SUMMARY;
  },
};
