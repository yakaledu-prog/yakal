// Single source of truth for role-based navigation.
// Replaces the hardcoded navigate("/student") calls scattered across auth pages.

export type Role = "student" | "tutor" | "counselor" | "parent" | "admin";

/** The dashboard home path for a given role. */
export function homePathForRole(role?: string | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "tutor":
      return "/tutor";
    case "counselor":
      return "/counselor";
    case "parent":
      return "/parent";
    case "student":
    default:
      return "/student";
  }
}

/** Roles that must be approved by an admin before they can use their portal. */
export function requiresApproval(role?: string | null): boolean {
  return role === "tutor" || role === "counselor";
}

/**
 * Where a freshly-authenticated user should land, based on their profile.
 * Handles: onboarding not done, pending approval gate, then role home.
 */
export function postAuthPath(
  profile: { role: string; status: string; is_onboarded: boolean } | null | undefined
): string {
  if (!profile) return "/student";
  if (!profile.is_onboarded) return "/onboarding";
  if (requiresApproval(profile.role) && profile.status === "pending") {
    return "/pending-approval";
  }
  if (profile.status === "rejected") return "/pending-approval";
  return homePathForRole(profile.role);
}
