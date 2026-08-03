import { useState, useEffect } from "react";
import { AdminCourse } from "@/services/adminService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { TipTapEditor } from "@/components/ui/TipTapEditor";
import { toast } from "sonner";
import { Loader2, X, ChevronRight, ChevronLeft, GraduationCap, DollarSign, RefreshCw, FileText, PackagePlusIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { useGoogleLogin } from "@react-oauth/google";
import { exchangeGoogleToken, fetchCourseWork } from "@/services/classroomService";

interface AdminCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AdminCourse | null;
  onSubmit: (data: Partial<AdminCourse>) => Promise<void>;
  isSubmitting?: boolean;
}

/** Everything courses_subject_check will accept. */
const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "SAT Prep", "College Advising", "Other",
];

export function AdminCourseModal({ isOpen, onClose, initialData, onSubmit, isSubmitting }: AdminCourseModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    description: "",
    price_cents: "",
    tutor_payout_cents: "",
    thumbnail_url: "",
    google_classroom_url: "",
    is_active: true,
  });

  const [classroomToken, setClassroomToken] = useState<string | null>(localStorage.getItem('google_classroom_token'));
  const [isFetchingClassroom, setIsFetchingClassroom] = useState(false);
  const [classroomPreview, setClassroomPreview] = useState<any[] | null>(null);
  const [previewLimit, setPreviewLimit] = useState(2);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (initialData) {
        setFormData({
          title: initialData.title || "",
          subject: initialData.subject || "",
          description: initialData.description || "",
          price_cents: initialData.price_cents ? (initialData.price_cents / 100).toString() : "",
          tutor_payout_cents: initialData.tutor_payout_cents ? (initialData.tutor_payout_cents / 100).toString() : "",
          thumbnail_url: initialData.thumbnail_url || "",
          google_classroom_url: initialData.google_classroom_url || "",
          is_active: initialData.is_active ?? true,
        });
      } else {
        setFormData({
          title: "",
          subject: "",
          description: "",
          price_cents: "",
          tutor_payout_cents: "",
          thumbnail_url: "",
          google_classroom_url: "",
          is_active: true,
        });
      }
      setClassroomPreview(null);
    }
  }, [isOpen, initialData]);

  const loginGoogle = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.rosters.readonly',
    onSuccess: async ({ code }) => {
      try {
        const data = await exchangeGoogleToken(code);
        setClassroomToken(data.access_token);
        localStorage.setItem('google_classroom_token', data.access_token);
        toast.success("Connected to Google Classroom");
        handleFetchClassroom(data.access_token);
      } catch (err: any) {
        toast.error(err.message || "Failed to connect to Google");
      }
    },
    onError: () => toast.error('Google login failed'),
  });

  const extractCourseId = (url: string) => {
    try {
      const match = url.match(/\/c\/([a-zA-Z0-9_]+)/);
      const rawId = match ? match[1] : null;
      if (!rawId) return null;

      // Google Classroom web URLs use base64 encoding for the numeric course ID
      try {
        const decoded = atob(rawId);
        if (/^\d+$/.test(decoded)) {
          return decoded;
        }
      } catch (e) {
        // Not valid base64 or not numeric, fallback to raw string
      }
      return rawId;
    } catch {
      return null;
    }
  };

  const handleFetchClassroom = async (tokenToUse: string | null = classroomToken) => {
    if (!formData.google_classroom_url) {
      return toast.error("Please enter a Google Classroom URL first");
    }
    const courseId = extractCourseId(formData.google_classroom_url);
    if (!courseId) {
      return toast.error("Invalid Google Classroom URL format. Example: https://classroom.google.com/c/MzUx...");
    }

    if (!tokenToUse) {
      loginGoogle();
      return;
    }

    setIsFetchingClassroom(true);
    try {
      const res = await fetchCourseWork(tokenToUse, courseId);
      setClassroomPreview(res.courseWork || []);
      toast.success("Successfully fetched course details!");
    } catch (error: any) {
      const msg = error.message || "";
      toast.error(msg || "Failed to fetch from Google Classroom. Try reconnecting.");
      if (msg.includes('401') || msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('credential') || msg.toLowerCase().includes('unauthorized')) {
        setClassroomToken(null);
        localStorage.removeItem('google_classroom_token');
      }
    } finally {
      setIsFetchingClassroom(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error("Course title is required");
      return;
    }

    const price = parseFloat(formData.price_cents);
    const payout = parseFloat(formData.tutor_payout_cents);

    const patch: Partial<AdminCourse> = {
      title: formData.title,
      subject: formData.subject || "Other",
      description: formData.description,
      thumbnail_url: formData.thumbnail_url,
      google_classroom_url: formData.google_classroom_url,
      is_active: formData.is_active, // We default to true in form state
      price_cents: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : null,
      tutor_payout_cents: Number.isFinite(payout) && payout >= 0 ? Math.round(payout * 100) : null,
    };

    await onSubmit(patch);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-[#111] dark:text-white">
            {initialData ? "Edit Course" : "Create New Course"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#182329] transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="bg-gray-50 dark:bg-[#182329] px-6 py-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between shrink-0">
          {[
            { num: 1, label: "Basic Info", icon: GraduationCap },
            { num: 2, label: "Description", icon: FileText },
            { num: 3, label: "Classroom & Pricing", icon: DollarSign }
          ].map((s, i) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setStep(s.num)}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-sm group-hover:opacity-80",
                  step >= s.num ? "bg-[#1099A1] text-white" : "bg-[#f1f1f1] dark:bg-[#202c33] text-muted-foreground border border-[#e9edef] dark:border-[#2a3942]"
                )}>
                  {s.num}
                  {/* <s.icon size={16} /> */}
                </div>
                <span className={cn(
                  "text-[13px] hidden md:block whitespace-nowrap group-hover:text-[#111] dark:group-hover:text-white transition-colors",
                  step >= s.num ? "text-[#111] dark:text-white" : "text-muted-foreground"
                )}>
                  {s.label}
                </span>
              </div>
              {i < 2 && <div className="flex-1 h-px bg-[#e9edef] dark:bg-[#2a3942] mx-2 lg:mx-4" />}
            </div>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">

          {step === 1 && (
            <div className="h-full flex flex-col max-w-lg mx-auto w-full justify-center space-y-8 py-4">
              <div className="flex-1 flex flex-col space-y-3">
                {!formData.thumbnail_url && <p className="text-sm text-center text-muted-foreground pb-2">
                  Upload a high-quality thumbnail for your course (SVG, PNG, JPG, or GIF, max 5MB).
                </p>}
                <ImageUpload
                  value={formData.thumbnail_url}
                  onChange={url => setFormData({ ...formData, thumbnail_url: url })}
                  className="w-full min-h-[300px] h-[300px] shrink-0 border-2"
                />
              </div>

              <div className="space-y-3 mt-auto">
                <Input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Course Title"
                  className="bg-gray-50 dark:bg-[#182329] !border !border-gray-300 dark:!border-gray-700 focus:bg-white text-lg font-medium py-6"
                />

                <select
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  aria-label="Subject"
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-3 text-[15px] text-[#111] outline-none focus:bg-white dark:border-gray-700 dark:bg-[#182329] dark:text-white"
                >
                  <option value="">Choose a subject</option>
                  {SUBJECTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-[calc(100%-250px)] min-h-[350px] bg-gray-50 dark:bg-[#182329] focus-within:bg-white relative overflow-hidden">
              <TipTapEditor
                value={formData.description}
                onChange={html => setFormData({ ...formData, description: html })}
                placeholder="Describe the course..."
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 h-full flex flex-col">
              <div className="space-y-3">
                <label className="text-[13px] mb-1 block text-muted-foreground">Google Classroom URL</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={formData.google_classroom_url}
                    onChange={e => setFormData({ ...formData, google_classroom_url: e.target.value })}
                    placeholder="https://classroom.google.com/c/..."
                    className="bg-gray-50 dark:bg-[#182329] border !border-gray-300 dark:border-gray-700 focus:bg-white flex-1"
                  />
                  <Button
                    onClick={() => handleFetchClassroom()}
                    disabled={isFetchingClassroom || !formData.google_classroom_url}
                    className="shrink-0"
                    variant="default"
                  >
                    {isFetchingClassroom ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {classroomPreview ? "Refetch Details" : "Fetch Details"}
                  </Button>
                </div>
                {!classroomPreview && (
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Provide the direct link to the Google Classroom. Clicking <strong>fetch</strong> will connect to the class   and show available assignments.
                  </p>
                )}
              </div>

              {classroomPreview !== null && (
                <div className="">
                  <p className="text-[13px] text-muted-foreground mb-4">
                    Found <strong>{classroomPreview.length}</strong> assignments in this course.
                  </p>

                  <div className="space-y-2 custom-scrollbar pr-2">
                    {classroomPreview.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground italic">No assignments posted yet.</p>
                    ) : (
                      classroomPreview.slice(0, previewLimit).map((cw, i) => (
                        <div key={i} className="bg-white dark:bg-[#111b21] p-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[13px]">
                          <p className="font-semibold text-[#111] dark:text-white truncate">{cw.title}</p>
                          {cw.description && <p className="text-muted-foreground truncate text-[12px] mt-1">{cw.description}</p>}
                        </div>
                      ))
                    )}
                    {classroomPreview.length > previewLimit && (
                      <div onClick={() => setPreviewLimit(classroomPreview.length)} className="cursor-pointer text-[12px] text-muted-foreground text-center pt-2">
                        + {classroomPreview.length - previewLimit} more assignment{classroomPreview.length - previewLimit > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="relative flex items-center mb-6 mt-4">
                <div className="flex-grow border-t border-[#e9edef] dark:border-[#2a3942]"></div>
                <span className="shrink-0 px-4 text-[11px] font-normal uppercase tracking-widest text-muted-foreground/70">Pricing</span>
                <div className="flex-grow border-t border-[#e9edef] dark:border-[#2a3942]"></div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-muted-foreground">Parent Price (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px] font-medium">$</span>
                      <Input
                        value={formData.price_cents}
                        onChange={e => setFormData({ ...formData, price_cents: e.target.value })}
                        placeholder="0.00"
                        className="pl-8 bg-gray-50 dark:bg-[#182329] border-transparent focus:bg-white text-lg font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-muted-foreground">Tutor Payout (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px] font-medium">$</span>
                      <Input
                        value={formData.tutor_payout_cents}
                        onChange={e => setFormData({ ...formData, tutor_payout_cents: e.target.value })}
                        placeholder="0.00"
                        className="pl-8 bg-gray-50 dark:bg-[#182329] border-transparent focus:bg-white text-lg font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#e9edef] dark:border-[#2a3942] flex justify-between shrink-0 bg-gray-50 dark:bg-[#182329]">
          <Button
            type="button"
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="w-[120px] !border !border-gray-300 dark:!border-gray-700 !bg-transparent"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> {step > 1 ? "Back" : "Cancel"}
          </Button>

          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)} className="w-[120px] ml-auto">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="w-[140px] ml-auto">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PackagePlusIcon size={15} strokeWidth={2} className="mr-2" />}
              {initialData ? "Save Changes" : "Create Course"}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
