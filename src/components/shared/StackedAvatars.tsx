import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

export interface StackedPerson {
  id?: string;
  name: string;
  avatarUrl?: string | null;
}

/**
 * The people a plan is between, overlapped.
 *
 * Overlapping rather than sitting side by side, because they are one
 * relationship and not two separate facts. Whoever the plan is for goes first;
 * the card's own background is the ring, so the stack reads as one object on
 * any surface.
 */
export function StackedAvatars({
  people,
  size = 36,
  className,
}: {
  people: (StackedPerson | null | undefined)[];
  size?: number;
  className?: string;
}) {
  const shown = people.filter(Boolean) as StackedPerson[];
  if (shown.length === 0) return null;

  return (
    <div className={cn("flex shrink-0 -space-x-2", className)}>
      {shown.map((person, i) => (
        <img
          key={person.id ?? `${person.name}-${i}`}
          src={person.avatarUrl || dicebearUrl(person.name)}
          alt={person.name}
          title={person.name}
          style={{ width: size, height: size }}
          className="rounded-full border-2 border-card object-cover"
        />
      ))}
    </div>
  );
}
