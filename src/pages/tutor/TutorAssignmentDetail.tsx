import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { ArrowLeft, ExternalLink, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  getAssignment, getSubmissions, reviewSubmission, AssignmentRow, SubmissionRow,
} from "@/services/tutorService";
import { RichText } from "@/components/ui/RichTextEditor";
import { dicebearUrl } from "@/utils/avatar";

function formatDue(d: string | null) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TutorAssignmentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [a, s] = await Promise.all([getAssignment(id), getSubmissions(id)]);
    setAssignment(a);
    setSubs(s);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const review = async (subId: string, status: "reviewed" | "revision_needed", feedback: string) => {
    if (await reviewSubmission(subId, status, feedback)) {
      toast.success(status === "reviewed" ? "Marked reviewed." : "Revision requested.");
      load();
    } else toast.error("Failed to save review.");
  };

  if (loading) {
    return <PageWrapper><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></PageWrapper>;
  }
  if (!assignment) {
    return <PageWrapper><div className="p-8 text-center text-[#54656f] dark:text-[#aebac1]">Assignment not found.</div></PageWrapper>;
  }

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
        <button onClick={() => navigate("/tutor/assignments")} className="flex items-center gap-1.5 text-[14px] text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white mb-6">
          <ArrowLeft size={16} /> Back to assignments
        </button>

        {/* Assignment card */}
        <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h1 className="text-2xl font-bold text-[#111] dark:text-white">{assignment.title}</h1>
            {assignment.course_title && <span className="text-[12px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">{assignment.course_title}</span>}
          </div>
          <div className="flex items-center gap-4 text-[13px] text-[#54656f] dark:text-[#aebac1] mb-4">
            <span className="flex items-center gap-1.5"><CalendarClock size={14} /> {formatDue(assignment.due_date)}</span>
            {assignment.template_url && (
              <a href={assignment.template_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary font-medium hover:underline">
                <ExternalLink size={14} /> Template
              </a>
            )}
          </div>
          {assignment.description && <RichText html={assignment.description} />}
        </div>

        {/* Submissions */}
        <h2 className="text-[16px] font-bold text-[#111] dark:text-white mb-3">
          Submissions <span className="text-[#54656f] dark:text-[#aebac1] font-medium">({subs.length})</span>
        </h2>
        {subs.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#54656f] dark:text-[#aebac1]">
            No submissions yet.
          </div>
        ) : (
          <div className="space-y-4">
            {subs.map((s) => <SubmissionCard key={s.id} sub={s} onReview={review} />)}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

function SubmissionCard({ sub, onReview }: { sub: SubmissionRow; onReview: (id: string, status: "reviewed" | "revision_needed", feedback: string) => void }) {
  const [feedback, setFeedback] = useState(sub.tutor_feedback || "");
  return (
    <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5">
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
