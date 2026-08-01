import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, ExternalLink, Calendar, Star, Search, BookOpen, ChevronLeft } from "lucide-react";
import { getCourse, getCourses, getPendingApplicantCounts, type AdminCourse } from "@/services/adminService";
import { money } from "@/services/billingService";
import { cn } from "@/utils/cn";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { CourseApplicants } from "@/components/admin/CourseApplicants";

// Mock Tutors

export function AdminCourseDetail() {
  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tutors");
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [query, setQuery] = useState("");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (id) {
      getCourse(id).then((data) => {
        setCourse(data);
        setIsLoading(false);
      });
    }
  }, [id]);

  // The other courses, for the sidebar. Same shape as the tutor's My Courses:
  // pick one on the left, work on it on the right, without going back to a
  // list page in between.
  useEffect(() => {
    getCourses().then(setCourses);
    getPendingApplicantCounts().then(setPendingCounts);
  }, []);

  // Courses with someone waiting float to the top, so the ones needing a
  // decision are found without opening each in turn.
  const filtered = courses
    .filter(
      (c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.subject.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => (pendingCounts[b.id] ?? 0) - (pendingCounts[a.id] ?? 0));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-[#1099A1] border-t-transparent rounded-full" /></div>;
  }

  if (!course) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Course not found</div>;
  }

  const tabs = [
    { id: "tutors", label: "Tutors" },
    { id: "students", label: "Students" },
    { id: "sessions", label: "Sessions" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className="course-page flex h-full min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* Left pane: search and the course list */}
      <aside
        className={cn(
          "w-full md:shrink-0 flex-col border-b border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#111b21] md:h-full md:w-[300px] md:border-b-0 md:border-r",
          listClass
        )}
      >
        <div className="border-b border-[#e9edef] px-3 pb-2 pt-4 dark:border-[#2a3942]">
          {/* Above the search rather than over the banner: the sidebar is
              where you move between courses, so leaving them belongs here. */}
          <button
            onClick={() => navigate("/admin/courses")}
            className="mb-2 flex items-center gap-1 px-2 text-[13px] font-medium text-[#1099A1] transition-colors hover:underline"
          >
            <ChevronLeft size={15} /> Back to Courses
          </button>

          <div className="group flex items-center gap-2 border-b-2 border-transparent px-2 py-2 transition focus-within:border-[#1099A1]">
            <Search size={18} className="shrink-0 text-[#697780] group-focus-within:text-[#1099A1]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses..."
              className="flex-1 bg-transparent text-[14px] text-[#111] outline-none placeholder:text-[#8696a0] dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const active = c.id === course.id;
            return (
              <button
                key={c.id}
                onClick={() => { openDetail(); navigate(`/admin/courses/${c.id}`); }}
                className={cn(
                  "flex w-full items-center gap-3 border-l-2 p-4 text-left transition-colors",
                  active
                    ? "border-l-[#1099A1] bg-[#1099A1]/5"
                    : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]"
                )}
              >
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#1099A1]/10 text-[#1099A1]">
                    <BookOpen size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[14px] font-semibold",
                      active ? "text-[#1099A1]" : "text-[#111] dark:text-white"
                    )}
                  >
                    {c.title}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {c.subject}
                    {pendingCounts[c.id] ? (
                      <span className="ml-1.5 font-medium text-[#8a6a2a] dark:text-[#CAA25F]">
                        {pendingCounts[c.id]} waiting
                      </span>
                    ) : null}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right pane */}
      <section
        className={cn(
          "min-w-0 min-h-0 flex-1 flex-col overflow-y-auto bg-[#fafafa] dark:bg-[#111b21] md:h-full",
          detailClass
        )}
      >
      {/* Header Banner */}
      <div className="w-full bg-[#1099A1] text-white pt-8 px-6 md:px-10 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="max-w-[1440px] mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="max-w-[800px]">
              {/* Only the phone needs this: on desktop the catalogue is still
                  beside the course. */}
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Back"
                className="-ml-2 mb-2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
              >
                <ChevronLeft size={22} />
              </button>
              <h1 className="text-[32px] md:text-[48px] font-bold tracking-tight mb-4 leading-tight">{course.title}</h1>
              {course.description ? (
                <div 
                  className="text-white/90 text-[15px] md:text-[18px] leading-relaxed mb-6 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: course.description }}
                />
              ) : (
                <p className="text-white/90 text-[15px] md:text-[18px] leading-relaxed mb-6">
                  Learn {course.subject} with our expert tutors. Tailored sessions for academic excellence.
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-6 text-[14px] font-medium text-white/95">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-[#F2C94C] text-[#F2C94C]" />
                  <span>4.8</span>
                  <span className="underline underline-offset-2 opacity-90 cursor-pointer hover:opacity-100">(320 reviews)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 opacity-80" />
                  <span>1,204 students enrolled</span>
                </div>
                {course.google_classroom_url && (
                  <a href={course.google_classroom_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 underline underline-offset-2 opacity-90 hover:opacity-100">
                    <ExternalLink size={14} /> Classroom
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end shrink-0 mt-4 md:mt-0">
              <div className="text-[28px] md:text-[36px] font-bold mb-1">
                {course.price_cents != null ? money(course.price_cents) : "—"}
                <span className="text-[16px] font-normal opacity-80 tracking-normal">/course</span>
              </div>
              <div className="text-[14px] opacity-90">
                Or starting at {course.tutor_payout_cents != null ? money(course.tutor_payout_cents) : "—"}/hr with tutors
              </div>
            </div>
          </div>

          {/* Tabs, along the foot of the header rather than a strip below it */}
          <div className="mt-8 flex overflow-x-auto no-scrollbar border-t border-white/20">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative whitespace-nowrap px-6 py-4 text-[15px] font-medium transition-colors",
                  activeTab === tab.id ? "text-white" : "text-white/60 hover:text-white"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 h-[3px] w-full rounded-t-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-[1440px] mx-auto p-6 md:p-10">

        {/* Anyone still waiting on a decision, above the tabs because that is
            what an admin opens an unassigned course to deal with. Who ended up
            teaching it is a different question and lives in the Tutors tab. */}
        {(pendingCounts[course.id] ?? 0) > 0 && (
          <>
            <CourseApplicants
              courseId={course.id}
              courseTitle={course.title}
              assignedTutorId={course.tutor_id ?? null}
              show="pending"
              onAssigned={() => {
                if (id) getCourse(id).then(setCourse);
                getPendingApplicantCounts().then(setPendingCounts);
              }}
            />
            <hr className="my-8 border-[#e9edef] dark:border-[#2a3942]" />
          </>
        )}

        {/* TUTORS TAB */}
        {activeTab === "tutors" && (
          <CourseApplicants
            courseId={course.id}
            courseTitle={course.title}
            assignedTutorId={course.tutor_id ?? null}
            show="assigned"
            onAssigned={() => {
              if (id) getCourse(id).then(setCourse);
              getPendingApplicantCounts().then(setPendingCounts);
            }}
          />
        )}

        {/* STUDENTS TAB */}
        {activeTab === "students" && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">Manage Students</h3>
              <p className="text-[14px] text-muted-foreground max-w-sm">
                View and manage all students enrolled in this course. You can assign them to specific tutors or sessions.
              </p>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === "sessions" && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">No upcoming sessions</h3>
              <p className="text-[14px] text-muted-foreground max-w-sm">
                There are currently no scheduled sessions for this course. Tutors will schedule sessions as needed.
              </p>
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
              <Star className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">4.8 Average Rating</h3>
              <p className="text-[14px] text-muted-foreground max-w-sm">
                Reviews will appear here once students complete course feedback forms.
              </p>
            </div>
          </div>
        )}

      </div>
      </section>
    </div>
  );
}
