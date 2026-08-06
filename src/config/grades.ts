/**
 * The grades a student can be in.
 *
 * Shared by onboarding and the student's profile, so the two cannot drift into
 * different wordings. They write the same `profiles.grade_level` column, and a
 * "Grade 9" saved by one screen has to match the option the other offers or it
 * opens with nothing selected.
 */
export const GRADE_LEVELS = [
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "University",
  "Other",
] as const;
