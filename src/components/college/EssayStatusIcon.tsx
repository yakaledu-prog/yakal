import { BadgeCheck, CircleDashed, FilePen, Hourglass } from "lucide-react";
import { cn } from "@/utils/cn";
import { EssayStatus } from "@/services/collegeService";

/**
 * Where an essay is in its life, as an icon.
 *
 * A single checkmark only ever answered "finished or not", which throws away
 * the three states in between. These are the states a counselor and a student
 * actually talk in, and the icons carry the same meaning as the review badges
 * elsewhere: a dashed ring is not started, a scalloped badge is signed off.
 */
const CONFIG: Record<
  EssayStatus,
  { icon: typeof BadgeCheck; label: string; className: string }
> = {
  todo: {
    icon: CircleDashed,
    label: "Not started",
    className: "text-[#a8adb8]",
  },
  drafting: {
    icon: FilePen,
    label: "Drafting",
    className: "text-[#1099A1]",
  },
  in_review: {
    icon: Hourglass,
    label: "With counselor",
    className: "text-[#CAA25F]",
  },
  done: {
    icon: BadgeCheck,
    label: "Done",
    className: "text-[#1099A1]",
  },
};

export function EssayStatusIcon({
  status,
  size = 17,
  className,
}: {
  status: EssayStatus;
  size?: number;
  className?: string;
}) {
  const { icon: Icon, label, className: tone } = CONFIG[status];
  return (
    <Icon
      size={size}
      aria-label={label}
      className={cn("shrink-0", tone, className)}
    />
  );
}
