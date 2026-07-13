import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { ExternalLink, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchAssignment, fetchSubmissions, gradeSubmission } from "@/services/classroomService";

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
  const token = localStorage.getItem('google_access_token');

  const [assignment, setAssignment] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token || !courseId) return;
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        fetchAssignment(token, courseId, id),
        fetchSubmissions(token, courseId, id)
      ]);
      setAssignment(a);
      setSubs(s.studentSubmissions || []);
    } catch (err) {
      toast.error("Failed to load assignment data from Google Classroom");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, courseId, token]);

  const handleGrade = async (subId: string, grade: number) => {
    if (!token || !courseId) return;
    try {
      await gradeSubmission(token, courseId, id, subId, grade);
      toast.success("Grade saved to Google Classroom!");
      load();
    } catch (err) {
      toast.error("Failed to save grade");
    }
  };

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
        <div className="bg-[#1099A1] text-white p-6 md:px-8 pb-8 shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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
                  {subs.map((s) => (
                    <SubmissionCard key={s.id} sub={s} maxPoints={assignment.maxPoints} onGrade={handleGrade} />
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

function SubmissionCard({ sub, maxPoints, onGrade }: { sub: any; maxPoints?: number; onGrade: (id: string, grade: number) => void }) {
  const [gradeInput, setGradeInput] = useState(sub.draftGrade?.toString() || "");
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
            <input 
              type="number" 
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              placeholder="Grade"
              className="w-20 h-9 bg-transparent border border-border/50 rounded-md px-2 text-[14px] focus:outline-none focus:border-[#1099A1]"
            />
            <span className="text-muted-foreground text-[14px]">/ {maxPoints}</span>
            <Button onClick={() => onGrade(sub.id, Number(gradeInput))} disabled={!gradeInput} className="h-9 ml-2 bg-[#1099A1] hover:bg-[#0d848b] text-white">Save</Button>
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
