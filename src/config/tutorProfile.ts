/**
 * What counts as a finished tutor profile.
 *
 * One definition, because three screens ask the question: onboarding decides
 * whether to nudge, the profile page draws the badge, and the tutor's own
 * editor marks off what is left. Three copies of the list is how a tutor ends
 * up "complete" on one screen and not on another.
 *
 * These four are what a family reads before choosing somebody. Education,
 * work history and certifications are worth having and are not on the list:
 * gating a badge on them makes a tutor with a degree and no photo look more
 * finished than one with a photo and no degree, which is backwards for the
 * only decision this affects.
 *
 * Rate is deliberately absent and must stay absent. Pricing is set by the
 * admin; a tutor never sets their own.
 */
export interface TutorProfileLike {
  bio?: string | null;
  subjects?: string[] | null;
  resume_url?: string | null;
  avatar_url?: string | null;
}

export interface ProfileRequirement {
  key: string;
  /** Said the way the tutor would say it, since it is shown to them. */
  label: string;
  /** Why it matters, so the nudge is a reason rather than a chore. */
  why: string;
  done: (p: TutorProfileLike) => boolean;
}

export const TUTOR_PROFILE_REQUIREMENTS: ProfileRequirement[] = [
  {
    key: "photo",
    label: "A photo",
    why: "Profiles with a photo get chosen more often than ones without.",
    done: (p) => !!p.avatar_url,
  },
  {
    key: "bio",
    label: "A short bio",
    // A one-line bio is technically filled in and tells a family nothing, so
    // the check is a length rather than a presence.
    why: "A few sentences on what you teach and how. Aim for 80 characters or more.",
    done: (p) => (p.bio ?? "").trim().length >= 80,
  },
  {
    key: "subjects",
    label: "Subjects you teach",
    why: "You only appear in searches for the subjects listed here.",
    done: (p) => (p.subjects?.length ?? 0) > 0,
  },
  {
    key: "resume",
    label: "Your resume",
    why: "Families and the admissions team read it before assigning students.",
    done: (p) => !!p.resume_url,
  },
];

export interface Completeness {
  done: number;
  total: number;
  percent: number;
  missing: ProfileRequirement[];
  complete: boolean;
}

export function tutorProfileCompleteness(p: TutorProfileLike | null | undefined): Completeness {
  const profile = p ?? {};
  const missing = TUTOR_PROFILE_REQUIREMENTS.filter((r) => !r.done(profile));
  const total = TUTOR_PROFILE_REQUIREMENTS.length;
  const done = total - missing.length;
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    missing,
    complete: missing.length === 0,
  };
}
