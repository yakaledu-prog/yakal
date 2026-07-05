import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import {
  Plus, ClipboardList, X, FileText, ExternalLink, Trash2, Loader2, CalendarClock,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTutorAssignments, createAssignment, deleteAssignment, getSubmissions,
  reviewSubmission, getTutorCourses, AssignmentRow, SubmissionRow,
} from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";

function formatDue(d: string | null) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TutorAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewing, setReviewing] = useState<AssignmentRow | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [a, c] = await Promise.all([getTutorAssignments(user.id), getTutorCourses(user.id)]);
    setAssignments(a);
    setCourses(c.map((x: any) => ({ id: x.id, title: x.title })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete this assignment and all its submissions?")) return;
    if (await deleteAssignment(id)) {
      toast.success("Assignment deleted.");
      load();
    } else toast.error("Failed to delete.");
  };

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 h-full dark:bg-[#111b21]">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111] dark:text-white">Assignments</h1>
            <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mt-1">Post work and review submissions.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-[#1099A1] hover:bg-[#0d848b] text-white shrink-0">
            <Plus size={18} /> New Assignment
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
            <ClipboardList size={48} className="mx-auto text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No assignments yet</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mb-4">Create your first assignment for your students.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-[#1099A1] hover:bg-[#0d848b] text-white"><Plus size={16} /> New Assignment</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => {
              const pending = (a.submissionCount ?? 0) - (a.reviewedCount ?? 0);
              return (
                <div key={a.id} className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <h3 className="text-[17px] font-bold text-[#111] dark:text-white">{a.title}</h3>
                        {a.course_title && <span className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a.course_title}</span>}
                      </div>
                      {a.description && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] line-clamp-2 mb-2">{a.description}</p>}
                      <div className="flex items-center gap-4 text-[12px] text-[#54656f] dark:text-[#aebac1]">
                        <span className="flex items-center gap-1.5"><CalendarClock size={13} /> {formatDue(a.due_date)}</span>
                        <span>{a.submissionCount} submitted</span>
                        {pending > 0 && <span className="text-[#CAA25F] font-semibold">{pending} to review</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.template_url && (
                        <a href={a.template_url} target="_blank" rel="noreferrer" className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[13px] font-semibold text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329]">
                          <ExternalLink size={14} /> Template
                        </a>
                      )}
                      <Button onClick={() => setReviewing(a)} className="h-9 gap-1.5 bg-[#1099A1] hover:bg-[#0d848b] text-white text-[13px]">
                        <FileText size={14} /> Submissions
                      </Button>
                      <button onClick={() => remove(a.id)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
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

      {createOpen && (
        <CreateModal
          courses={courses}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}
      {reviewing && (
        <SubmissionsModal assignment={reviewing} onClose={() => setReviewing(null)} onChanged={load} />
      )}
    </PageWrapper>
  );
}

function CreateModal({ courses, onClose, onCreated }: { courses: { id: string; title: string }[]; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title is required.");
    setSaving(true);
    const { error } = await createAssignment({
      tutor_id: user.id,
      course_id: courseId || null,
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      template_url: templateUrl.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Assignment created.");
    onCreated();
  };

  const field = "w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary text-[14px]";
  const lbl = "text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
          <h2 className="text-[20px] font-bold text-[#111] dark:text-white">New Assignment</h2>
          <button onClick={onClose} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><label className={lbl}>Title *</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Derivatives Practice Sheet" /></div>
          <div className="space-y-1.5">
            <label className={lbl}>Course</label>
            <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.length === 0 && <option value="">No courses assigned</option>}
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {courses.length === 0 && <p className="text-[12px] text-[#CAA25F]">Without a course, students can't see this assignment.</p>}
          </div>
          <div className="space-y-1.5"><label className={lbl}>Description</label><textarea className={cn(field, "h-auto py-2 resize-none")} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><label className={lbl}>Due date</label><input type="datetime-local" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="space-y-1.5"><label className={lbl}>Template link (Google Drive)</label><input className={field} value={templateUrl} onChange={(e) => setTemplateUrl(e.target.value)} placeholder="https://drive.google.com/..." /></div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-10 px-6 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold">{saving ? "Creating..." : "Create"}</Button>
        </div>
      </div>
    </div>
  );
}

function SubmissionsModal({ assignment, onClose, onChanged }: { assignment: AssignmentRow; onClose: () => void; onChanged: () => void }) {
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setSubs(await getSubmissions(assignment.id));
    setLoading(false);
  };
  useEffect(() => { load(); }, [assignment.id]);

  const review = async (id: string, status: "reviewed" | "revision_needed", feedback: string) => {
    if (await reviewSubmission(id, status, feedback)) {
      toast.success(status === "reviewed" ? "Marked reviewed." : "Revision requested.");
      load();
      onChanged();
    } else toast.error("Failed to save review.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div>
            <h2 className="text-[18px] font-bold text-[#111] dark:text-white">Submissions</h2>
            <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">{assignment.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
          ) : subs.length === 0 ? (
            <p className="text-center text-[14px] text-[#54656f] dark:text-[#aebac1] py-10">No submissions yet.</p>
          ) : subs.map((s) => <SubmissionCard key={s.id} sub={s} onReview={review} />)}
        </div>
      </div>
    </div>
  );
}

function SubmissionCard({ sub, onReview }: { sub: SubmissionRow; onReview: (id: string, status: "reviewed" | "revision_needed", feedback: string) => void }) {
  const [feedback, setFeedback] = useState(sub.tutor_feedback || "");
  return (
    <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <img src={sub.student_avatar || dicebearUrl(sub.student_name || "S")} alt="" className="w-8 h-8 rounded-full object-cover" />
          <span className="text-[14px] font-semibold text-[#111] dark:text-white">{sub.student_name}</span>
        </div>
        <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full capitalize",
          sub.status === "reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
          sub.status === "revision_needed" ? "bg-red-100 text-red-600 dark:bg-red-900/20" : "bg-primary/10 text-primary")}>
          {sub.status.replace("_", " ")}
        </span>
      </div>
      {sub.drive_url ? (
        <a href={sub.drive_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline mb-3">
          <ExternalLink size={14} /> Open submission
        </a>
      ) : <p className="text-[13px] text-[#54656f] mb-3">No file link.</p>}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        placeholder="Feedback for the student..."
        className="w-full rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-transparent p-2.5 text-[13px] text-[#111] dark:text-white focus:outline-none focus:border-primary resize-none mb-3"
      />
      <div className="flex gap-2">
        <Button onClick={() => onReview(sub.id, "reviewed", feedback)} className="flex-1 h-9 text-[13px] bg-[#1099A1] hover:bg-[#0d848b] text-white">Mark Reviewed</Button>
        <Button variant="outline" onClick={() => onReview(sub.id, "revision_needed", feedback)} className="flex-1 h-9 text-[13px] border-[#e9edef] dark:border-[#2a3942]">Request Revision</Button>
      </div>
    </div>
  );
}
