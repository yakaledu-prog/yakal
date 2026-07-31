import { cn } from "@/utils/cn";

// ============================================================
// Role marks for the conversation list.
//
// The list used to print the role as a word under each name, which ate the row
// the last message needs. These carry the same information beside the name.
//
// One brand colour for all five, no chip or disc behind them: the glyph is
// what distinguishes a role, not a hue.
// ============================================================

export type Role = "student" | "tutor" | "parent" | "counselor" | "admin";

function normalize(role: string | undefined | null): Role {
  const r = (role ?? "").toLowerCase();
  if (r === "tutor" || r === "parent" || r === "counselor" || r === "admin") return r;
  return "student";
}

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  tutor: "Tutor",
  parent: "Parent",
  counselor: "Counselor",
  admin: "Admin",
};

function Glyph({ role, size }: { role: Role; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (role) {
    // Graduation cap.
    case "student":
      return (
        <svg {...common}>
          <path d="M12 4 2 9l10 5 10-5-10-5Z" />
          <path d="M6 11.2V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.8" />
          <path d="M21 9.5v4.2" />
        </svg>
      );
    // A figure framed by an open laptop.
    case "tutor":
      return (
        <svg {...common}>
          <rect x="4.4" y="4.2" width="15.2" height="10" rx="1.2" />
          <path d="M2.4 17.6h19.2l-1.5-3.4H3.9Z" />
          <circle cx="12" cy="8" r="1.9" />
          <path d="M8.8 13.4a3.3 3.3 0 0 1 6.4 0" />
        </svg>
      );
    // An adult and a child.
    case "parent":
      return (
        <svg {...common}>
          <circle cx="8.5" cy="6.5" r="2.8" />
          <path d="M3.5 20.5c0-2.8 2.2-5 5-5s5 2.2 5 5" />
          <circle cx="17.5" cy="11" r="2" />
          <path d="M14 20.5c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5" />
        </svg>
      );
    // Signpost, two arms pointing the way.
    case "counselor":
      return (
        <svg {...common}>
          <path d="M12 2.4v19.2" />
          <path d="M12 5h6.6l1.8 2.3-1.8 2.3H12z" />
          <path d="M12 12.6H5.4l-1.8 2.3 1.8 2.3H12z" />
        </svg>
      );
    // Person with a cog: the one who configures things.
    case "admin":
      return (
        <svg {...common}>
          <circle cx="10" cy="7.4" r="3.2" />
          <path d="M3.6 20.4c0-3.2 2.9-5.8 6.4-5.8 1 0 1.9.2 2.7.5" />
          <circle cx="17.6" cy="17.4" r="2.6" />
          <path d="M17.6 13.4v1.4M17.6 20v1.4M21 15.4l-1.2.7M15.4 18.7l-1.2.7M21 19.4l-1.2-.7M15.4 16.1l-1.2-.7" />
        </svg>
      );
  }
}

/** The glyph on its own, inheriting colour from its parent. */
export function RoleIcon({
  role,
  size = 14,
  className,
}: {
  role: string | undefined | null;
  size?: number;
  className?: string;
}) {
  const r = normalize(role);
  return (
    <span className={cn("inline-flex shrink-0", className)} title={ROLE_LABEL[r]}>
      <Glyph role={r} size={size} />
    </span>
  );
}

/**
 * The glyph next to a name. Takes the colour of the text around it rather than
 * a brand colour of its own, so it reads as part of the label instead of
 * competing with it.
 */
export function RoleBadge({
  role,
  size = 15,
  className,
}: {
  role: string | undefined | null;
  size?: number;
  className?: string;
}) {
  const r = normalize(role);
  return (
    <span
      title={ROLE_LABEL[r]}
      aria-label={ROLE_LABEL[r]}
      className={cn(
        "inline-flex items-center justify-center shrink-0 text-[#444] dark:text-[#8696a0]",
        className
      )}
    >
      <Glyph role={r} size={size} />
    </span>
  );
}

export { normalize as normalizeRole };
