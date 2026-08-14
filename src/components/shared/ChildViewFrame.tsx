import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, Lock, Users } from "lucide-react";
import { ChildSidebar } from "@/pages/parent/billing/shared";
import { cn } from "@/utils/cn";

import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import {
  getChildServices,
  getLinkedChildren,
  type ServiceName,
} from "@/services/parentService";

// ============================================================
// The frame around a parent's read-only view of one child.
//
// The College List and the Roadmap are the student's own pages rendered
// against the child's id. Everything those pages do not do is here: choosing
// which child, saying so when there is none, and refusing when the parent has
// not opted the child into the service.
//
// The refusal is a courtesy, not a control. A parent has SELECT on a linked
// child's college rows and nothing else, enforced by row level security, so
// the pages themselves are safe whatever this component renders.
// ============================================================

export interface FramedChild {
  id: string;
  name: string;
  avatarUrl: string | null;
  gradeLevel: string | null;
}

export function ChildViewFrame({
  title,
  subtitle,
  chrome = true,
  onChildChange,
  headerRight,
  headerBottom,
  /** The service the child must be opted into. Omit to always allow. */
  requiresService,
  children,
}: {
  title?: string;
  subtitle?: string;
  /**
   * False where the wrapped page already has a header of its own. Explore
   * opens with its own banner, and the frame's made a second one directly
   * above it saying the same thing.
   */
  chrome?: boolean;
  /**
   * Fired when the shown child changes. The frame owns that choice, so a page
   * that also needs the id had no way to learn it except by reaching into the
   * render callback, which meant setting state during render.
   */
  onChildChange?: (childId: string) => void;
  /** Facts that belong beside the title, e.g. stage and graduation year. */
  headerRight?: ReactNode;
  /** Tabs or anything else that sits along the bottom edge of the banner. */
  headerBottom?: ReactNode;
  requiresService?: ServiceName;
  children: (child: FramedChild) => ReactNode;
}) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: linked = [], isLoading } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const childIds = linked.map((c) => c.id);
  const { data: services = [] } = useQuery({
    queryKey: ["children-services", childIds.join(",")],
    queryFn: () => getChildServices(childIds),
    enabled: childIds.length > 0,
  });

  const active = linked.find((c) => c.id === selectedId) ?? linked[0] ?? null;

  const activeId = active?.id;
  useEffect(() => {
    if (activeId) onChildChange?.(activeId);
  }, [activeId, onChildChange]);

  const child: FramedChild | null = active
    ? {
      id: active.id,
      name: active.full_name,
      avatarUrl: active.avatar_url ?? null,
      gradeLevel: active.grade_level ?? null,
    }
    : null;

  const allowed =
    !requiresService ||
    (!!child &&
      services.some(
        (s) => s.student_id === child.id && s.service === requiresService && s.is_active
      ));

  return (
    <PageWrapper className="!p-0">
      {/* Header, then the children, then the page. The child used to be a
          dropdown tucked under the title, which is a different control from
          the rail every other parent page uses for the same choice. One rail,
          one habit. A grid keeps a single DOM order and moves the rail into
          its own column at md. */}
      <div className="grid min-h-full grid-cols-1 bg-background md:grid-cols-[260px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] dark:bg-[#111b21]">
        <div className="md:col-start-2 md:row-start-1">
        {chrome ? (
        <header className="relative overflow-hidden bg-primary px-6 pt-6 text-white md:px-10 md:pt-10">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path
              d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
                <p className="pt-1 text-[15px] text-white/80">{subtitle}</p>
              </div>
              {headerRight}
            </div>

            {!headerBottom && <div className="h-6" />}

            {headerBottom}
          </div>
        </header>
        ) : null}

        </div>

        {linked.length > 1 && (
          <div className="md:col-start-1 md:row-span-2 md:h-full md:overflow-y-auto">
            <ChildSidebar
              children={linked}
              activeId={child?.id ?? null}
              onSelect={(id) => id && setSelectedId(id)}
              countFor={() => 0}
              showAll={false}
              sublineFor={(c) => c.grade_level || "Grade not set"}
            />
          </div>
        )}

        <div className={cn("pb-12 md:row-start-2", linked.length > 1 ? "md:col-start-2" : "md:col-span-2")}>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : !child ? (
          <Empty
            icon={<Users size={40} className="text-[#aebac1]" />}
            title="No children linked yet"
            body="Add a child by their email address. Once they accept, their college work appears here."
            action={{ to: "/parent/children", label: "Manage children" }}
          />
        ) : !allowed ? (
          <Empty
            icon={<Lock size={40} className="text-primary" />}
            title="College admissions is not switched on"
            body={`${child.name} is not opted into the admissions service, so there is nothing to show here yet.`}
            action={{ to: "/parent/children", label: "Manage services" }}
          />
        ) : (
          // Keyed on the child so switching resets the page's own state rather
          // than carrying one child's open tab and scroll into the next.
          <div key={child.id}>{children(child)}</div>
        )}
        </div>
      </div>
    </PageWrapper>
  );
}

function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: { to: string; label: string };
}) {
  return (
    <div className="mx-auto p-6 md:p-10">
      <div className="rounded-xl border border-dashed border-[#e9edef] py-16 text-center dark:border-[#2a3942]">
        <div className="mb-4 flex justify-center">{icon}</div>
        <p className="text-[15px] font-medium text-[#111] dark:text-white">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#717182]">{body}</p>
        <Link
          to={action.to}
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
