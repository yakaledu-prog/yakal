import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { CalendarClock, ExternalLink } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import { createAssignment, getTutorCourses } from "@/services/tutorService";
import { BlockEditor } from "@/components/ui/BlockEditor";
import { RichText, stripHtml } from "@/components/ui/RichTextEditor";

function formatDue(v: string) {
  if (!v) return "No due date";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TutorAssignmentNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTutorCourses(user.id).then((c) => {
      const list = c.map((x: any) => ({ id: x.id, title: x.title }));
      setCourses(list);
      if (list[0]) setCourseId(list[0].id);
    });
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title is required.");
    setSaving(true);
    const { error } = await createAssignment({
      tutor_id: user.id,
      course_id: courseId || null,
      title: title.trim(),
      description: stripHtml(description) ? description : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      template_url: templateUrl.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Assignment created.");
    navigate("/tutor/assignments");
  };

  const field = "w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary text-[14px]";
  const lbl = "text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]";
  const courseTitle = courses.find((c) => c.id === courseId)?.title;
  const hasInstructions = !!stripHtml(description);

  return (
    <div className="assignment-new flex flex-col lg:flex-row h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Left: form */}
      <div className="assignment-new__form w-full lg:w-1/2 shrink-0 lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#e9edef] dark:border-[#2a3942] p-6 md:p-8 space-y-5">
        <div className="space-y-1.5"><label className={lbl}>Title *</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Derivatives Practice Sheet" /></div>

        <div className="space-y-1.5">
          <label className={lbl}>Course</label>
          <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.length === 0 && <option value="">No courses assigned</option>}
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          {courses.length === 0 && <p className="text-[12px] text-[#CAA25F]">Without a course, students can't see this assignment.</p>}
        </div>

        <div className="space-y-1.5">
          <label className={lbl}>Instructions</label>
          <BlockEditor value={description} onChange={setDescription} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><label className={lbl}>Due date</label><input type="datetime-local" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="space-y-1.5"><label className={lbl}>Template link (Drive)</label><input className={field} value={templateUrl} onChange={(e) => setTemplateUrl(e.target.value)} placeholder="https://drive.google.com/..." /></div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => navigate("/tutor/assignments")} className="h-11 px-6 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-11 px-6 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold">{saving ? "Creating..." : "Create Assignment"}</Button>
        </div>
      </div>

      {/* Right: live student preview */}
      <div className="assignment-new__preview flex-1 min-w-0 lg:h-full lg:overflow-y-auto bg-muted/20 dark:bg-[#111b21] p-6 md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-4">What students will see</p>
        <div className="rounded-2xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182329] p-6 md:p-8">
          <h1 className={`text-2xl font-bold mb-3 ${title ? "text-[#111] dark:text-white" : "text-muted-foreground italic"}`}>
            {title || "Untitled assignment"}
          </h1>
          {courseTitle && <span className="inline-block text-[12px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full mb-4">{courseTitle}</span>}
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground mb-5">
            <span className="flex items-center gap-1.5"><CalendarClock size={14} /> {formatDue(dueDate)}</span>
            {templateUrl && <span className="flex items-center gap-1.5 text-primary font-medium"><ExternalLink size={14} /> Template</span>}
          </div>
          {hasInstructions
            ? <RichText html={description} />
            : <p className="text-[14px] text-muted-foreground italic">Instructions will appear here as you type…</p>}
        </div>
      </div>
    </div>
  );
}
