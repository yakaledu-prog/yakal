import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, PenTool , Sparkles } from "lucide-react";

import { ChildViewFrame } from "@/components/shared/ChildViewFrame";
import { getCollegeProfile } from "@/services/collegeService";
import { cn } from "@/utils/cn";
import { ROADMAP_TABS, StudentRoadmap, type RoadmapTab } from "@/pages/student/StudentRoadmap";

// ============================================================
// The parent's view of a child's college roadmap.
//
// Previously a fork of the student page that read and, worse, wrote against
// the parent's own id: the autosave in the header created a college
// application row on the parent's account every time the page was opened.
//
// It is now the student's roadmap rendered against the child, read only. The
// timeline needs the child's grade level to know which year to highlight, so
// the frame passes it down rather than letting it fall back to the signed-in
// profile.
//
// Stage, major and graduation year sit in the banner beside the title, and the
// tabs along its bottom edge, matching the counselor's version of the same
// page. That means the tab lives here rather than inside the roadmap, which is
// why it is passed down.
// ============================================================

const TAB_ICON: Record<RoadmapTab, React.ReactNode> = {
  timeline: <Calendar size={16} />,
  testing: <PenTool size={16} />,
  resources: <BookOpen size={16} />,
  assistant: <Sparkles size={16} />,
};

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium capitalize text-white">{value}</p>
    </div>
  );
}

export function ParentRoadmap() {
  const [tab, setTab] = useState<RoadmapTab>("timeline");
  const [childId, setChildId] = useState<string | null>(null);

  // Same query key as the roadmap itself, so this shares its cache rather than
  // fetching the application twice.
  const { data } = useQuery({
    queryKey: ["college-profile", childId],
    queryFn: () => getCollegeProfile(childId!),
    enabled: !!childId,
  });
  const app = data?.application;

  return (
    <ChildViewFrame
      onChildChange={setChildId}
      title="College roadmap"
      subtitle="Where your child is up to, and what comes next."
      requiresService="admissions"
      headerRight={
        <div className="flex flex-wrap items-start gap-x-10 gap-y-3 pt-1">
          <HeaderFact
            label="Stage"
            value={app?.stage === "research" ? "Researching" : (app?.stage ?? "Not set")}
          />
          <HeaderFact label="Intended major" value={app?.program_interest || "Not chosen yet"} />
          <HeaderFact label="Grad year" value={app?.grad_year ? String(app.grad_year) : "Not set"} />
        </div>
      }
      headerBottom={
        <nav className="mt-6 flex gap-1 overflow-x-auto">
          {ROADMAP_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-[14px] transition-colors",
                tab === t.id
                  ? "border-white font-semibold text-white"
                  : "border-transparent text-white/60 hover:text-white"
              )}
            >
              {TAB_ICON[t.id]}
              {t.label}
            </button>
          ))}
        </nav>
      }
    >
      {(child) => {
        return (
          <StudentRoadmap
            studentId={child.id}
            gradeLevel={child.gradeLevel}
            subjectName={child.name.split(" ")[0]}
            embedded
            hideChrome
            tab={tab}
            onTabChange={setTab}
          />
        );
      }}
    </ChildViewFrame>
  );
}
