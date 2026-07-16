import { useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { ExternalLink, CalendarClock, Loader2 } from "lucide-react";
import { fetchAssignment, fetchSubmissions } from "@/services/classroomService";

function formatDue(dueDate: any, dueTime: any) {
  if (!dueDate) return "No due date";
  const { year, month, day } = dueDate;
  const d = new Date(year, month - 1, day);
  let str = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (dueTime && dueTime.hours !== undefined) {
    const min = String(dueTime.minutes || 0).padStart(2, '0');
    str += ` at ${dueTime.hours}:${min}`;
  }
  return str;
}

export function TutorAssignmentDetail() {
  const { id = "" } = useParams();
  const location = useLocation();
  const courseId = location.state?.courseId;
  const token = localStorage.getItem('google_classroom_token');

  const { data, isLoading: loading } = useQuery({
    queryKey: ['classroom-assignment', courseId, id],
    queryFn: async () => {
      const [a, s] = await Promise.all([
        fetchAssignment(token!, courseId, id),
        fetchSubmissions(token!, courseId, id)
      ]);
      return { assignment: a, subs: s.studentSubmissions || [] };
    },
    enabled: !!token && !!courseId && !!id,
  });

  const assignment = data?.assignment;
  const subs = data?.subs || [];



  if (!courseId || !token) {
    return <PageWrapper><div className="p-8 text-center text-muted-foreground">Missing course context or authentication. Please go back to assignments.</div></PageWrapper>;
  }

  if (loading) {
    return <PageWrapper><div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#1099A1]" /></div></PageWrapper>;
  }
  
  if (!assignment) {
    return <PageWrapper><div className="p-8 text-center text-muted-foreground">Assignment not found.</div></PageWrapper>;
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex flex-col h-[calc(100vh-64px)] bg-background dark:bg-[#111b21]">
        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white p-6 md:px-8 pb-8 shrink-0 relative overflow-hidden">
          {/* Subtle Background Texture/Graph */}
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{assignment.title}</h1>
              <div className="flex items-center gap-4 text-white/80 text-[14px]">
                <span className="flex items-center gap-1.5"><CalendarClock size={14} /> Due: {formatDue(assignment.dueDate, assignment.dueTime)}</span>
                <span>{assignment.maxPoints ? `${assignment.maxPoints} Points Max` : 'Ungraded'}</span>
              </div>
            </div>
            <a href={assignment.alternateLink} target="_blank" rel="noreferrer" className="inline-flex items-center h-10 px-4 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors shrink-0">
              View in Google Classroom <ExternalLink size={16} className="ml-2" />
            </a>
          </div>
        </div>

        {/* Content Below Banner (Two Panes) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          
          {/* Left Pane: Instructions */}
          <aside className="w-full lg:w-[380px] shrink-0 bg-white dark:bg-[#182329] border-b lg:border-b-0 lg:border-r border-border/50 p-6 md:p-8 lg:h-full lg:overflow-y-auto">
            <h3 className="text-[16px] font-semibold text-foreground mb-4">Instructions</h3>
            {assignment.description ? (
              <p className="text-[14px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
            ) : (
              <p className="text-[14px] text-muted-foreground italic">No instructions provided.</p>
            )}
          </aside>

          {/* Right Pane: Submissions */}
          <section className="flex-1 min-w-0 bg-muted/20 dark:bg-[#111b21] lg:h-full lg:overflow-y-auto">
            <div className="sticky top-0 z-10 bg-muted/20 dark:bg-[#111b21] backdrop-blur px-6 md:px-8 py-5 border-b border-border/50">
              <h2 className="text-[16px] font-bold text-foreground">
                Student Submissions <span className="text-muted-foreground font-medium ml-1">({subs.length})</span>
              </h2>
            </div>
            
            <div className="p-6 md:p-8">
              {subs.length === 0 ? (
                <div className="py-24 flex items-center justify-center text-center">
                  <p className="text-[14px] text-muted-foreground">No students have submitted this assignment yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {subs.map((s: any) => (
                    <SubmissionCard key={s.id} sub={s} maxPoints={assignment.maxPoints} />
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </PageWrapper>
  );
}

function SubmissionCard({ sub, maxPoints }: { sub: any; maxPoints?: number }) {
  const isTurnedIn = sub.state === "TURNED_IN" || sub.state === "RETURNED";
  const attachments = sub.assignmentSubmission?.attachments || [];

  return (
    <div className="bg-white dark:bg-[#202c33] border border-border/50 rounded-xl p-5 shadow-sm transition-all hover:border-[#1099A1]/40">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground">Student ID: {sub.userId}</h3>
            <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full capitalize",
              isTurnedIn ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
              "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              {sub.state.replace("_", " ")}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {attachments.length > 0 ? `${attachments.length} files attached` : "No attachments"}
          </p>
        </div>
        
        {maxPoints && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground text-[14px]">
              Grade: <span className="font-semibold text-foreground">{sub.assignedGrade ?? sub.draftGrade ?? '-'}</span> / {maxPoints}
            </span>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {attachments.map((att: any, idx: number) => {
            const driveFile = att.driveFile;
            if (!driveFile) return null;
            return (
              <a key={idx} href={driveFile.alternateLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors">
                <img src={driveFile.thumbnailUrl} alt="" className="w-8 h-8 object-cover rounded" onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className="text-[13px] font-medium text-foreground truncate">{driveFile.title}</span>
              </a>
            );
          })}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-border/40 flex justify-end">
        <a href={sub.alternateLink} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-[#1099A1] hover:underline flex items-center">
          Open in Classroom <ExternalLink size={14} className="ml-1" />
        </a>
      </div>
    </div>
  );
}
