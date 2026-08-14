/** Paid enrolments lead; session-only students remain for legacy bookings. */
export function mergeRosterIds(enrolledIds: string[], sessionStudentIds: string[]): string[] {
  return [...new Set([...enrolledIds, ...sessionStudentIds])];
}
