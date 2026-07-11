import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FloatingInput } from "@/components/ui/FloatingField";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createAssignment, getTutorCourses } from "@/services/tutorService";
import { BlockEditor } from "@/components/ui/BlockEditor";
import { stripHtml } from "@/components/ui/RichTextEditor";

export function TutorAssignmentNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<{ label: string; value: string }[]>([]);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTutorCourses(user.id).then((c) => {
      const list = c.map((x: any) => ({ label: x.title, value: x.id }));
      setCourses(list);
      if (list[0]) setCourseId(list[0].value);
    });
  }, [user]);

  const pasteTemplate = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTemplateUrl(t.trim());
    } catch {
      toast.error("Couldn't read the clipboard.");
    }
  };

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

  return (
    <div className="assignment-new flex flex-col lg:flex-row h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Left: configuration */}
      <div className="assignment-new__config w-full lg:w-[380px] shrink-0 lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#e9edef] dark:border-[#2a3942] p-6 md:p-8 flex flex-col">
        <div className="space-y-5 flex-1">
          <FloatingInput label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />

          {courses.length > 0 ? (
            <SelectMenu label="Course" value={courseId} onChange={setCourseId} options={courses} />
          ) : (
            <p className="text-[13px] text-[#CAA25F]">No courses assigned, students won't see the assignment.</p>
          )}

          <FloatingInput label="Due date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

          <div className="relative">
            <FloatingInput
              label="Template link (Drive)"
              type="url"
              value={templateUrl}
              onChange={(e) => setTemplateUrl(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={pasteTemplate}
              title="Paste from clipboard"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-md text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#182329] transition-colors"
            >
              <ClipboardPaste size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-6 mt-auto">
          <Button variant="outline" onClick={() => navigate("/tutor/assignments")} className="h-11 flex-1 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-11 flex-1 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold">{saving ? "Creating..." : "Create"}</Button>
        </div>
      </div>

      {/* Right: full-height instructions editor (this is exactly what students see) */}
      <div className="assignment-new__editor flex-1 min-w-0 lg:h-full">
        <BlockEditor
          value={description}
          onChange={setDescription}
          fullHeight
          placeholder="Write the assignment instructions… (type '/' for headings, lists, and more)"
        />
      </div>
    </div>
  );
}
