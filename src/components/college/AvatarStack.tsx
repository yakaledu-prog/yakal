import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { CollegeLogo } from "./CollegeLogo";

/**
 * Who wrote it, and what it is for, in one slot.
 *
 * A counsellor's queue mixes every student and every college, so a row has two
 * identities to carry before it carries anything else. Side by side they take
 * the width of the title; overlapped they read as one object and answer both
 * questions at a glance, which is how a chat client shows a group.
 *
 * The person leads and the crest sits behind, because whose essay this is
 * decides whether you open it at all.
 */
export function AvatarStack({
  name,
  avatarUrl,
  collegeName,
  collegeLogo = null,
  collegeWebsite = null,
  size = 40,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  /** Absent for a personal statement, which belongs to no one college. */
  collegeName?: string | null;
  collegeLogo?: string | null;
  collegeWebsite?: string | null;
  size?: number;
  className?: string;
}) {
  // The crest is smaller and tucked under the corner, the way a badge sits.
  const badge = Math.round(size * 0.58);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={avatarUrl || dicebearUrl(name)}
        alt=""
        className="h-full w-full rounded-full object-cover"
      />
      {collegeName && (
        // Ringed in the page colour so the two shapes stay separate against a
        // card, a hover tint and both themes.
        <CollegeLogo
          name={collegeName}
          logo={collegeLogo}
          website={collegeWebsite}
          size={badge}
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
        />
      )}
    </div>
  );
}
