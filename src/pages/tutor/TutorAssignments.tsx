import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Plus, ClipboardList, FileText, ExternalLink, Trash2, CalendarClock } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorAssignments, deleteAssignment, AssignmentRow } from "@/services/tutorService";
import { stripHtml } from "@/components/ui/RichTextEditor";

function formatDue(d: string | null) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TutorAssignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setAssignments(await getTutorAssignments(user.id));
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this assignment and all its submissions?")) return;
    if (await deleteAssignment(id)) { toast.success("Assignment deleted."); load(); }
    else toast.error("Failed to delete.");
  };

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 h-full dark:bg-[#111b21]">
        {/* Create card */}
        <button
          onClick={() => navigate("/tutor/assignments/new")}
          className="new-assignment-card w-full mb-4 flex items-center gap-4 rounded-xl border-2 border-dashed border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182329] p-5 text-left hover:border-primary/50 hover:bg-primary/[0.02] transition-colors group"
        >
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
            <Plus size={22} />
          </div>
          <div>
            <p className="font-semibold text-[15px] text-[#111] dark:text-white">New Assignment</p>
            <p className="text-[13px] text-muted-foreground">Post work for your students and review submissions.</p>
          </div>
        </button>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-14 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
            <ClipboardList size={44} className="mx-auto text-[#aebac1] mb-3" />
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">No assignments yet, create one above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => {
              const pending = (a.submissionCount ?? 0) - (a.reviewedCount ?? 0);
              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/tutor/assignments/${a.id}`)}
                  className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5 shadow-sm cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <h3 className="text-[17px] font-bold text-[#111] dark:text-white">{a.title}</h3>
                        {a.course_title && <span className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a.course_title}</span>}
                      </div>
                      {a.description && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] line-clamp-2 mb-2">{stripHtml(a.description)}</p>}
                      <div className="flex items-center gap-4 text-[12px] text-[#54656f] dark:text-[#aebac1]">
                        <span className="flex items-center gap-1.5"><CalendarClock size={13} /> {formatDue(a.due_date)}</span>
                        <span>{a.submissionCount} submitted</span>
                        {pending > 0 && <span className="text-[#CAA25F] font-semibold">{pending} to review</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {a.template_url && (
                        <a href={a.template_url} target="_blank" rel="noreferrer" className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[13px] font-semibold text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329]">
                          <ExternalLink size={14} /> Template
                        </a>
                      )}
                      <Button onClick={() => navigate(`/tutor/assignments/${a.id}`)} className="h-9 gap-1.5 bg-[#1099A1] hover:bg-[#0d848b] text-white text-[13px]">
                        <FileText size={14} /> Submissions
                      </Button>
                      <button onClick={(e) => remove(e, a.id)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
