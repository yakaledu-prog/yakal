import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { StudentDiagnosticOnboarding } from "@/pages/student/StudentDiagnosticOnboarding";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FloatingInput, FloatingTextarea } from "@/components/ui/FloatingField";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { GRADE_LEVELS } from "@/config/grades";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { fireConfetti } from "@/utils/confetti";
import { dicebearUrl } from "@/utils/avatar";
import { toast } from "sonner";
import { Check, Loader2, Trash, FileText, FileUp, X, Camera, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import logoImg from "@/assets/images/logo.webp";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";
import subjMath from "@/assets/images/subject-algebra.webp";
import subjPhysics from "@/assets/images/subject-physics.webp";
import subjSat from "@/assets/images/subject-sat-prep.webp";
import subjAdvising from "@/assets/images/resource-book-session.webp";
import subjOther from "@/assets/images/about-offer.webp";
import { gradYearFromGrade } from "@/config/admissionsCalendar";
import { TutorResume, type TutorResumeData, type ResumeSection } from "@/components/shared/TutorResume";
import { ResumeEntryDialog } from "@/components/shared/ResumeEntryDialog";
import { upsertApplication } from "@/services/collegeService";

const SUBJECTS = [
  "K-12 Math", "K-12 ELA", "Physics", "Standardized Tests",
  "AP Courses", "College Essays"
];

const SUBJECT_IMAGES: Record<string, string> = {
  "K-12 Math": subjMath,
  "K-12 ELA": "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&q=70",
  Physics: subjPhysics,
  "Standardized Tests": subjSat,
  "AP Courses": subjAdvising,
  "College Essays": "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&q=70",
};

interface OnboardingPageProps {
  previewRole?: string;
}

export function OnboardingPage({ previewRole }: OnboardingPageProps = {}) {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const isPreview = !!previewRole;
  const role = previewRole ?? profile?.role ?? "student";

  const [step, setStep] = useState(1);
  // Students do the short wizard first, then the diagnostic assessment.
  const [studentStage, setStudentStage] = useState<"profile" | "diagnostic">("profile");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);

  const [fullName, setFullName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [subjects, setSubjects] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [intendedMajor, setIntendedMajor] = useState("");
  // Held here and written with everything else at the end, so skipping the
  // step leaves nothing half saved.
  const [resume, setResume] = useState<TutorResumeData>({
    education: [],
    workExperience: [],
    certifications: [],
    languages: [],
  });
  const [addingTo, setAddingTo] = useState<ResumeSection | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState("");

  const [childrenDetails, setChildrenDetails] = useState<{ email: string; services: string[]; full_name?: string; avatar_url?: string }[]>([]);
  const [newChildEmail, setNewChildEmail] = useState("");
  const [newChildServiceType, setNewChildServiceType] = useState<string>("");

  useEffect(() => {
    if (isPreview) {
      setAvatarUrl(dicebearUrl("preview", "identicon"));
      return;
    }
    if (profile) {
      setFullName(profile.full_name || "");
      setTheme((profile.theme as "light" | "dark") || "light");
      setAvatarUrl(profile.avatar_url || dicebearUrl(profile.id || profile.full_name || "yakal", "identicon"));
      setSubjects(profile.subjects || []);
      setBio(profile.bio || "");
      setGradeLevel(profile.grade_level || "");
      setCvUrl((profile as any).resume_url || "");
    }
  }, [profile, isPreview]);

  useEffect(() => {
    if (theme === "system") {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Make sure avatar changes when fullName changes (if it's an identicon)
  useEffect(() => {
    setAvatarUrl((prev) => {
      if (prev && prev.includes("/identicon/")) {
        return dicebearUrl(fullName || "yakal", "identicon");
      }
      return prev;
    });
  }, [fullName]);

  const handleAddChild = () => {
    if (!newChildEmail.includes('@')) return toast.error("Please enter a valid email address");
    if (!newChildServiceType) return toast.error("Please select a service");
    if (childrenDetails.some(c => c.email === newChildEmail)) return toast.error("Child already added");

    // Simulate user lookup (true if student@ or yakal is in email)
    const exists = newChildEmail.includes('student') || newChildEmail.includes('yakal') || newChildEmail.includes('amen');

    const services = newChildServiceType === "both" ? ["tutoring", "admissions"] : [newChildServiceType];

    setChildrenDetails([...childrenDetails, {
      email: newChildEmail,
      services: services,
      full_name: exists ? newChildEmail.split('@')[0] : undefined,
      avatar_url: exists ? dicebearUrl(newChildEmail, "identicon") : undefined,
    }]);
    setNewChildEmail("");
    setNewChildServiceType("");
  };

  const handleRemoveChild = (index: number) => {
    setChildrenDetails(childrenDetails.filter((_, i) => i !== index));
  };

  const toggleChildService = (index: number, service: string) => {
    const updated = [...childrenDetails];
    const services = updated[index].services;
    if (services.includes(service)) {
      updated[index].services = services.filter((s) => s !== service);
    } else {
      updated[index].services.push(service);
    }
    setChildrenDetails(updated);
  };

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");

    if (isPreview || !user) {
      setAvatarUrl(URL.createObjectURL(file));
      toast("Shown locally, log in to save your photo.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Photo uploaded.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed. The avatars bucket may not be set up yet.");
    } finally {
      setUploading(false);
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Please choose a file under 5 MB.");

    if (isPreview || !user) {
      setCvFile(file);
      setCvUrl(URL.createObjectURL(file));
      toast("CV shown locally, log in to save.");
      return;
    }

    setUploadingCv(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/cv_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // The path, not a URL. The bucket is private because a CV carries a home
      // address and a phone number, so anyone reading it later asks for a
      // short-lived signed URL instead.
      setCvUrl(path);
      setCvFile(file);
      toast.success("CV uploaded.");
    } catch (err: any) {
      toast.error(err.message || "Could not upload your CV. Please try again.");
    } finally {
      setUploadingCv(false);
    }
  };

  const StudentSteps = ["Profile", "Preferences"];
  const TutorSteps = ["Profile", "CV / Resume", "Subjects", "Background"];
  const ParentSteps = ["Profile", "Theme", "Children"];
  const CounselorSteps = ["Profile", "CV / Resume", "Bio"];

  const stepsList =
    role === "student" ? StudentSteps
      : role === "tutor" ? TutorSteps
        : role === "parent" ? ParentSteps
          : CounselorSteps;
  const isLastStep = step === stepsList.length;

  const handleNextOrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLastStep) {
      // Required of both. Everything else about a tutor's profile can be
      // filled in later, but there is no version of being approved to teach
      // that does not involve somebody reading a CV first.
      if ((role === "tutor" || role === "counselor") && step === 2 && !cvUrl && !cvFile) {
        return toast.error("Please upload your CV before proceeding.");
      }
      setStep(step + 1);
      return;
    }

    await submit();
  };

  /** The save itself, so Skip for now can reach it without a form event. */
  const submit = async () => {
    if (role === "parent" && childrenDetails.length === 0) {
      toast.error("Please add at least one child to continue.");
      return;
    }

    if (isPreview) {
      fireConfetti();
      toast.success("Looks good! (Preview mode, nothing was saved.)");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const updates: Record<string, unknown> = {
        theme,
        avatar_url: avatarUrl,
        // A student is not finished here: the diagnostic assessment comes next
        // and marks them onboarded when it ends, whether they answer or skip.
        is_onboarded: role !== "student",
      };

      // We only update fullName if it's Parent/Counselor since Tutor doesn't ask for it
      if (role !== "tutor") {
        updates.full_name = fullName.trim();
      }

      if (role === "student") {
        updates.grade_level = gradeLevel || null;
      }

      if (role === "tutor") {
        updates.subjects = subjects;
        updates.education = resume.education;
        updates.work_experience = resume.workExperience;
        updates.certifications = resume.certifications;
        updates.languages = resume.languages;
        updates.bio = bio.trim() || null;
        updates.resume_url = cvUrl || null;
      } else if (role === "counselor") {
        updates.bio = bio.trim() || null;
        updates.resume_url = cvUrl || null;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      // In real life, we would save `childrenDetails` to a database table here for Parent

      await refreshProfile();

      if (role === "student") {
        // Seed the college application from what was just answered, so the
        // roadmap opens on the right year instead of asking again in its own
        // banner. The graduation year is derived rather than asked: a grade
        // goes stale every August, a year does not.
        const gradYear = gradYearFromGrade(gradeLevel, new Date());
        if (gradYear || intendedMajor.trim()) {
          await upsertApplication(user.id, {
            grad_year: gradYear,
            program_interest: intendedMajor.trim() || null,
          });
        }
        // Straight into the assessment, no confetti yet: the journey is not over.
        setStudentStage("diagnostic");
        return;
      }

      const fresh = await refreshProfile();
      const dest = postAuthPath(fresh ?? { role, status: profile?.status ?? "active", is_onboarded: true });
      fireConfetti();
      toast.success("Profile setup complete!");
      setTimeout(() => navigate(dest), 450);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  // Wait for the profile rather than assuming a role.
  //
  // `role` falls back to "student" when the profile has not arrived, and the
  // student branch below hands the whole screen to the diagnostic assessment.
  // Straight after signup the profile is always still loading, so every new
  // tutor and counselor was dropped into the student diagnostic and never saw
  // their own wizard.
  if (!isPreview && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21]">
        <Loader2 className="animate-spin text-primary" size={26} />
      </div>
    );
  }

  if (role === "student" && (studentStage === "diagnostic" || isPreview)) {
    return <div className="min-h-screen flex font-sans bg-[#f8f9fa] dark:bg-[#111b21]">
      <div className="hidden lg:block lg:w-[45%] relative">
        <img src={logoImg} alt="Yakal Education" className="absolute z-50 left-5 top-5 h-15 object-cover" />
        <img src={imgCover} alt="Yakal Education" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute bottom-16 left-16 right-16">
          <h2 className="text-[42px] font-bold text-white mb-4 leading-[50px] max-w-[500px]">
            Personalized tutoring for students who want to excel.
          </h2>
          <p className="text-[18px] text-white/90 max-w-[450px] leading-[28px]">
            Expert guidance, flexible scheduling, and tailored learning plans to help you achieve your academic goals.
          </p>
        </div>
      </div>
      <StudentDiagnosticOnboarding />
    </div>

  }

  return (
    <div className="min-h-screen flex font-sans bg-[#f8f9fa] dark:bg-[#111b21]">

      {/* Left side: Immersive Image (Hidden on small screens) */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={imgCover} alt="Yakal Education" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute bottom-16 left-16 right-16">
          <h2 className="text-[42px] font-bold text-white mb-4 leading-[50px] max-w-[500px]">
            Personalized tutoring for students who want to excel.
          </h2>
          <p className="text-[18px] text-white/90 max-w-[450px] leading-[28px]">
            Expert guidance, flexible scheduling, and tailored learning plans to help you achieve your academic goals.
          </p>
        </div>
      </div>

      {/* Right side: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-[540px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl p-8">

          <div className="mb-8 text-center">
            <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
              <img src={logoImg} alt="Yakal" className="h-12 object-contain mx-auto" />
            </Link>
          </div>

          <form onSubmit={handleNextOrSubmit} className="flex flex-col">

            {/* Stepper UI */}
            <div className="flex items-center justify-between mb-8 px-2">
              {stepsList.map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold z-10",
                    step === i + 1 ? "bg-primary text-white" : step > i + 1 ? "bg-primary text-white" : "bg-[#e9edef] dark:bg-[#2a3942] text-[#54656f] dark:text-[#aebac1]"
                  )}>
                    {step > i + 1 ? <Check size={14} /> : i + 1}
                  </div>
                  <span className={cn(
                    "text-[13px] font-medium hidden sm:block whitespace-nowrap",
                    step === i + 1 ? "text-[#111] dark:text-white" : "text-[#54656f] dark:text-[#aebac1]"
                  )}>
                    {s}
                  </span>
                  {i < stepsList.length - 1 && <div className="flex-1 h-[2px] bg-[#e9edef] dark:bg-[#2a3942] mx-2" />}
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col justify-start gap-5">

              {/* Profile Image Component (Reusable across steps) */}
              {(step === 1) && (
                <div className="flex flex-col items-center mb-2">
                  <div className="relative group">
                    <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border border-[#e9edef] dark:border-[#2a3942] shadow-inner bg-white" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-hover transition">
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </div>
              )}

              {/* Common Step 1 fields (Only for Parent/Counselor) */}
              {step === 1 && role !== "tutor" && (
                <div className="flex flex-col gap-5">
                  <FloatingInput
                    label="Full name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="capitalize"
                  />
                </div>
              )}

              {/* Tutor Step 1: Profile (Bio) */}
              {role === "tutor" && step === 1 && (
                <div className="flex flex-col gap-4 mt-4">
                  <FloatingTextarea
                    label="Short bio"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1]">
                    Your account will be reviewed by an administrator before activation.
                  </p>
                </div>
              )}

              {/* Tutor and counsellor step 2: the CV the admin reviews */}
              {(role === "tutor" || role === "counselor") && step === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="p-6 border-2 border-dashed border-[#e9edef] dark:border-[#2a3942] rounded-xl flex flex-col items-center justify-center text-center bg-[#f8f9fa] dark:bg-[#1a2329] hover:bg-[#f1f3f5] dark:hover:bg-[#202c33] transition-colors cursor-pointer"
                    onClick={() => cvInputRef.current?.click()}>
                    {uploadingCv ? (
                      <Loader2 size={32} className="animate-spin text-primary mb-2" />
                    ) : (
                      <FileUp size={32} className="text-primary mb-2" />
                    )}
                    <h3 className="text-[#111] dark:text-white font-semibold text-[15px] mb-1">
                      Upload your CV / Resume
                    </h3>
                    <p className="text-[#54656f] dark:text-[#aebac1] text-[13px]">
                      PDF, DOCX, or Image (Max 5MB)
                    </p>
                    {/* Matches the mime types the resumes bucket accepts. It
                        used to offer image/* as well, which the bucket rejects. */}
                    <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleCvUpload} />
                  </div>

                  {cvFile && (
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={18} className="text-primary flex-shrink-0" />
                        <span className="text-[13px] text-[#111] dark:text-white truncate font-medium">
                          {cvFile.name}
                        </span>
                      </div>
                      <button type="button" onClick={() => { setCvFile(null); setCvUrl(""); }} className="p-1 text-[#54656f] hover:text-red-500 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tutor Step 3: Subjects */}
              {role === "tutor" && step === 3 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-medium text-[#111] dark:text-white">
                      Subjects you teach
                      {subjects.length > 0 && (
                        <span className="text-primary font-semibold"> · {subjects.length}</span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {SUBJECTS.map((s) => {
                      const active = subjects.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSubject(s)}
                          className={cn(
                            "relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all",
                            active
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-[#e9edef] dark:border-[#2a3942] hover:border-primary/50"
                          )}
                        >
                          <img
                            src={SUBJECT_IMAGES[s]}
                            alt={s}
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = subjOther;
                            }}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                          <span className="absolute bottom-2 left-2.5 right-2 text-white text-[13px] font-semibold text-left leading-tight">
                            {s}
                          </span>
                          {active && (
                            <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
                              <Check size={13} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tutor Step 4: the background a family reads on the catalog.
                  The same component and the same dialog the profile page uses,
                  so an entry added here and one added later are the same shape
                  and there is one editor to keep right. Skippable, like the
                  rest: none of it blocks teaching, all of it helps being
                  found. */}
              {role === "tutor" && step === 4 && (
                <div className="space-y-4">
                  <p className="text-[13px] text-muted-foreground">
                    Education, work and certifications appear on your card in the course catalog.
                    Add what you have now, or fill it in later from your profile.
                  </p>
                  <TutorResume
                    resume={resume}
                    onAdd={(section) => setAddingTo(section)}
                    onRemove={(section, index) =>
                      setResume((r) => ({ ...r, [section]: r[section].filter((_, i) => i !== index) }))
                    }
                  />
                </div>
              )}

              {/* Student Step 2: grade level, then the same theme cards */}
              {role === "student" && step === 2 && (
                <div className="flex flex-col gap-6">
                  {/* SelectMenu, not a native select: the operating system
                      draws that one, so it ignores the theme and looks like a
                      different application on Windows. */}
                  <SelectMenu
                    label="What grade are you in?"
                    value={gradeLevel}
                    onChange={setGradeLevel}
                    options={[...GRADE_LEVELS]}
                  />

                  {/* Asked here rather than on the roadmap banner, where it
                      was three inputs a student had to notice were editable.
                      Optional: plenty of people do not know yet, and an empty
                      answer is more honest than a guess they never revisit. */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-semibold text-[#111] dark:text-white">
                      What do you want to study? (optional)
                    </label>
                    <input
                      value={intendedMajor}
                      onChange={(e) => setIntendedMajor(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="h-11 rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-transparent px-3.5 text-[14px] outline-none transition-colors focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Parent Step 2: Theme Cards */}
              {(role === "parent" || role === "student") && step === 2 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Light Theme Card */}
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={cn("flex flex-col items-center gap-3 transition-all", theme === "light" ? "opacity-100" : "opacity-60 hover:opacity-100")}
                      >
                        <div className={cn("w-full aspect-[4/3] rounded-[16px] border-2 overflow-hidden flex flex-col bg-[#f3f4f6]", theme === "light" ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-[#e5e7eb]")}>
                          <div className="h-8 bg-white border-b border-[#e5e7eb] flex items-center px-3 justify-between">
                            <div className="w-10 h-2.5 rounded-full bg-[#111]" />
                            <div className="w-4 h-4 rounded-full bg-primary" />
                          </div>
                          <div className="flex-1 bg-white p-3 flex flex-col gap-2">
                            <div className="w-full h-8 rounded-lg border border-[#e5e7eb]" />
                            <div className="w-full h-6 rounded-lg border border-[#e5e7eb] flex items-center justify-end px-2">
                              <Check size={12} className="text-[#9ca3af]" />
                            </div>
                          </div>
                        </div>
                        <span className="text-[14px] font-semibold text-[#111] dark:text-white">Light</span>
                      </button>

                      {/* Dark Theme Card */}
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={cn("flex flex-col items-center gap-3 transition-all", theme === "dark" ? "opacity-100" : "opacity-85 hover:opacity-100")}
                      >
                        <div className={cn("w-full aspect-[4/3] rounded-[16px] border-2 overflow-hidden flex flex-col bg-[#111827]", theme === "dark" ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-[#1f2937]")}>
                          <div className="h-8 bg-[#1f2937] border-b border-[#374151] flex items-center px-3 justify-between">
                            <div className="w-10 h-2.5 rounded-full bg-[#d1d5db]" />
                            <div className="w-4 h-4 rounded-full bg-[#ef4444]" />
                          </div>
                          <div className="flex-1 bg-[#111827] p-3 flex flex-col gap-2">
                            <div className="w-full h-8 rounded-lg bg-[#1f2937]" />
                            <div className="w-full h-6 rounded-lg bg-[#1f2937] flex items-center justify-end px-2">
                              <Check size={12} className="text-[#4b5563]" />
                            </div>
                          </div>
                        </div>
                        <span className="text-[14px] font-semibold text-[#111] dark:text-white">Dark</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Parent Step 3: Children */}
              {role === "parent" && step === 3 && (
                <div className="flex flex-col gap-6">
                  <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mb-2">
                    Enter the emails of your children and select the services they will have access to.
                  </p>

                  {/* Top Input Area (No white card) */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Embedded Input and Selector */}
                    <div className="flex-1 flex items-center rounded-[12px] border border-[#e9edef] dark:border-[#2a3942] bg-transparent focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all overflow-hidden h-14">
                      <div className="relative flex-1 h-full">
                        <input
                          type="email"
                          placeholder="Child's email address"
                          value={newChildEmail}
                          onChange={(e) => setNewChildEmail(e.target.value)}
                          className="w-full h-full bg-transparent px-4 text-[14px] text-[#111] dark:text-white focus:outline-none placeholder:text-[#54656f] dark:placeholder:text-[#aebac1]"
                        />
                      </div>

                      <div className="h-6 w-[1px] bg-[#e9edef] dark:bg-[#2a3942]" />

                      <div className="relative flex items-center h-full">
                        <select
                          value={newChildServiceType}
                          onChange={(e) => setNewChildServiceType(e.target.value)}
                          className="h-full bg-transparent text-[13px] font-medium text-[#54656f] dark:text-[#aebac1] outline-none cursor-pointer pl-4 pr-8 appearance-none"
                        >
                          <option value="" disabled>Select Service</option>
                          <option value="tutoring">Tutoring Service</option>
                          <option value="admissions">College Admission</option>
                          <option value="both">Both Services</option>
                        </select>
                        <ChevronDown size={14} className="text-[#8696a0] absolute right-3 pointer-events-none" />
                      </div>

                      <Button
                        type="button"
                        onClick={handleAddChild}
                        disabled={!newChildEmail.includes('@') || !newChildServiceType}
                        className="bg-primary hover:bg-primary-hover text-white px-5 rounded-[12px] font-medium m-2"
                      >
                        Add
                      </Button>
                    </div>


                  </div>

                  {/* List of Added Children (No white cards, simple border bottom list) */}
                  {childrenDetails.length > 0 && (
                    <div className="mt-4 border-t border-[#e9edef] dark:border-[#2a3942] pt-4">
                      <p className="text-[13px] font-semibold text-[#111] dark:text-white mb-2">Children with access</p>
                      <div className="flex flex-col">
                        {childrenDetails.map((child, idx) => {
                          const exists = !!child.full_name;
                          return (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
                              <div className="flex items-center gap-3">
                                {exists && (
                                  <img src={child.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#e9edef] dark:border-[#2a3942]" />
                                )}
                                <div className="flex flex-col">
                                  {exists ? (
                                    <>
                                      <span className="text-[14px] font-bold text-[#111] dark:text-white leading-tight capitalize">{child.full_name}</span>
                                      <span className="text-[12px] text-[#54656f] dark:text-[#aebac1]">{child.email}</span>
                                    </>
                                  ) : (
                                    <span className="text-[14px] font-semibold text-[#111] dark:text-white leading-tight">{child.email}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0">
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex bg-[#f8f9fa] dark:bg-[#111b21] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942] gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleChildService(idx, 'tutoring')}
                                      className={cn("px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all", child.services.includes('tutoring') ? "bg-white dark:bg-[#202c33] text-primary" : "text-[#54656f]/50 italic dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                                    >
                                      Tutoring
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleChildService(idx, 'admissions')}
                                      className={cn("px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all", child.services.includes('admissions') ? "bg-white dark:bg-[#202c33] text-primary" : "text-[#54656f]/50 italic dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                                    >
                                      Admissions
                                    </button>
                                  </div>
                                </div>
                                {/* {!exists && (
                                  <button type="button" onClick={() => toast.success("Invite sent!")} className="text-[13px] font-bold text-primary hover:underline ml-2">Invite</button>
                                )} */}
                                <button type="button" onClick={() => handleRemoveChild(idx)} className="p-2 text-[#8696a0] hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 ml-1" title="Remove">
                                  <Trash size={16} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Counselor Step 3: Bio */}
              {role === "counselor" && step === 3 && (
                <>
                  <FloatingTextarea
                    label="Short bio"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1]">
                    Your account will be reviewed by an administrator before activation.
                  </p>
                </>
              )}

            </div>

            <div className="mt-8 flex justify-between items-center pt-5 border-t border-[#e9edef] dark:border-[#2a3942]">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="px-6 rounded-xl border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]">
                  Back
                </Button>
              ) : <div />}

              <div className="flex items-center gap-4">
                {/* Skipping is offered rather than tolerated. A tutor stuck
                    without a resume to hand used to be stuck at step two, and
                    the profile badge does the asking from here on. */}
                {role === "tutor" && step > 2 && (
                  <button
                    type="button"
                    onClick={() => setConfirmSkip(true)}
                    disabled={loading}
                    className="text-[13.5px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Skip for now
                  </button>
                )}

                <Button
                  type="submit"
                  className="px-8 h-11 bg-primary hover:bg-primary-hover text-white rounded-xl text-[14px] font-bold"
                  disabled={loading}
                >
                  {loading ? "Saving..." : isLastStep ? "Complete Setup" : "Next"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>

      {/* Asked rather than done, the same way skipping the diagnostic is. The
          step costs nothing to skip and something to have skipped, and that is
          exactly the case worth a sentence before it happens. */}
      {confirmSkip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#202c33] max-w-md w-full rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">
                {step === 3 ? "Skip subjects?" : "Skip your background?"}
              </h3>
              <p className="text-[#54656f] dark:text-[#aebac1] text-[15px] leading-relaxed">
                {step === 3
                  ? "Families search the catalog by subject, so a profile without any is harder to find. You can pick them later from your profile."
                  : "Your education, work and certifications are what a family reads on your card before booking. You can add them later from your profile."}
              </p>
            </div>
            <div className="p-4 bg-[#f8f9fa] dark:bg-[#182329] border-t border-[#e9edef] dark:border-[#2a3942] flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmSkip(false)}
                className="border-[#e9edef] dark:border-[#2a3942] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setConfirmSkip(false);
                  if (isLastStep) void submit();
                  else setStep(step + 1);
                }}
                disabled={loading}
                className="bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-80"
              >
                {loading ? "Skipping..." : "Skip for now"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {addingTo && (
        <ResumeEntryDialog
          section={addingTo}
          onSave={(entry) => {
            setResume((r) => ({ ...r, [addingTo]: [...r[addingTo], entry] }));
            setAddingTo(null);
          }}
          onClose={() => setAddingTo(null)}
        />
      )}
    </div>
  );
}
