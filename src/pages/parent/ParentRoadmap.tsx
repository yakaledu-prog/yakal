import { useState } from "react";
import { BookOpen, Calendar, PenTool } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { ROADMAP_TABS, StudentRoadmap, type RoadmapTab } from "@/pages/student/StudentRoadmap";

// ============================================================
// The college roadmap, for a parent.
//
// The same advice every family gets, with nobody's name on it. It used to be
// the student page rendered against a chosen child: a child picker down the
// side, the child's stage, intended major and graduation year in the banner,
// and the timeline anchored on their year with "Amen is here" against the term
// they were in.
//
// None of that is what a parent opens this for. They are reading the plan, to
// see what a year asks for and whether it is being done, and a page that has
// to be told which child first puts a step in front of that. Where a specific
// child stands is a different question, and My Children answers it.
//
// So the grades are the parent's to click. Nothing here reads a student, which
// is also what stops the older bug coming back: before the child frame, this
// page fell through to the signed-in id and created a college application row
// on the parent's own account every time it was opened.
// ============================================================

const TAB_ICON: Record<RoadmapTab, React.ReactNode> = {
  timeline: <Calendar size={16} />,
  testing: <PenTool size={16} />,
  resources: <BookOpen size={16} />,
};

export function ParentRoadmap() {
  const [tab, setTab] = useState<RoadmapTab>("timeline");

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <div className="relative overflow-hidden bg-primary text-white">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 px-6 pt-6 md:px-10 md:pt-10">
            <h1 className="text-3xl font-bold tracking-tight md:text-[40px]">College roadmap</h1>
            <p className="mt-2 max-w-2xl text-[15px] text-white/80">
              What each year of secondary school asks for, and when. Pick a year to read it.
            </p>

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
          </div>
        </div>

        <StudentRoadmap generic embedded hideChrome tab={tab} onTabChange={setTab} />
      </div>
    </PageWrapper>
  );
}
