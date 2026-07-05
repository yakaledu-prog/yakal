import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import { createAssignment, getTutorCourses } from "@/services/tutorService";
import { BlockEditor } from "@/components/ui/BlockEditor";
import { stripHtml } from "@/components/ui/RichTextEditor";

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

  return (
    <div className="assignment-new flex flex-col lg:flex-row h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Left: configuration */}
      <div className="assignment-new__config w-full lg:w-[360px] shrink-0 lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#e9edef] dark:border-[#2a3942] p-6 md:p-8 flex flex-col">
        <div className="space-y-5 flex-1">
          <div className="space-y-1.5"><label className={lbl}>Title *</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Derivatives Practice Sheet" /></div>

          <div className="space-y-1.5">
            <label className={lbl}>Course</label>
            <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.length === 0 && <option value="">No courses assigned</option>}
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {courses.length === 0 && <p className="text-[12px] text-[#CAA25F]">Without a course, students can't see this assignment.</p>}
          </div>

          <div className="space-y-1.5"><label className={lbl}>Due date</label><input type="datetime-local" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="space-y-1.5"><label className={lbl}>Template link (Drive)</label><input className={field} value={templateUrl} onChange={(e) => setTemplateUrl(e.target.value)} placeholder="https://drive.google.com/..." /></div>
        </div>

        <div className="flex items-center gap-3 pt-6 mt-auto">
          <Button variant="outline" onClick={() => navigate("/tutor/assignments")} className="h-11 flex-1 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-11 flex-1 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold">{saving ? "Creating..." : "Create"}</Button>
        </div>
      </div>

      {/* Right: full-height instructions editor */}
      <div className="assignment-new__editor flex-1 min-w-0 lg:h-full flex flex-col">
        <div className="px-6 md:px-8 py-4 border-b border-[#e9edef] dark:border-[#2a3942]">
          <h2 className="text-[15px] font-bold text-[#111] dark:text-white">Instructions</h2>
          <p className="text-[12px] text-muted-foreground">Type “/” for headings, lists, and more. This is exactly what students will see.</p>
        </div>
        <div className="flex-1 min-h-0 px-3 md:px-5 py-2">
          <BlockEditor value={description} onChange={setDescription} fullHeight />
        </div>
      </div>
    </div>
  );
}
