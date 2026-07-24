import re

content = """import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { StudentDiagnosticOnboarding } from "@/pages/student/StudentDiagnosticOnboarding";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FloatingInput, FloatingTextarea } from "@/components/ui/FloatingField";
import { MoneyInput, Currency } from "@/components/ui/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { fireConfetti } from "@/utils/confetti";
import { dicebearUrl } from "@/utils/avatar";
import { toast } from "sonner";
import { Moon, Sun, Check, Loader2, Trash, FileText, FileUp, X, Camera, User } from "lucide-react";
import { cn } from "@/utils/cn";
import logoImg from "@/assets/images/logo.webp";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";
import subjMath from "@/assets/images/subject-algebra.webp";
import subjPhysics from "@/assets/images/subject-physics.webp";
import subjSat from "@/assets/images/subject-sat-prep.webp";
import subjAdvising from "@/assets/images/resource-book-session.webp";
import subjOther from "@/assets/images/about-offer.webp";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "SAT Prep", "College Advising", "Other",
];

const SUBJECT_IMAGES: Record<string, string> = {
  Mathematics: subjMath,
  Physics: subjPhysics,
  "SAT Prep": subjSat,
  "College Advising": subjAdvising,
  Chemistry: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=400&q=70",
  Biology: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&q=70",
  English: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&q=70",
  Other: subjOther,
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const [fullName, setFullName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [subjects, setSubjects] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState<Currency>("ETB");
  const [bio, setBio] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState("");

  const [childrenDetails, setChildrenDetails] = useState<{ email: string; services: string[] }[]>([]);
  const [newChildEmail, setNewChildEmail] = useState("");

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
      setHourlyRate(profile.hourly_rate != null ? String(profile.hourly_rate) : "");
      setCurrency((profile.rate_currency as Currency) || "ETB");
      setBio(profile.bio || "");
      setCvUrl((profile as any).resume_url || "");
    }
  }, [profile, isPreview]);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
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
    if (childrenDetails.some(c => c.email === newChildEmail)) return toast.error("Child already added");
    setChildrenDetails([...childrenDetails, { email: newChildEmail, services: ["tutoring"] }]);
    setNewChildEmail("");
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
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("resumes").getPublicUrl(path);
      setCvUrl(data.publicUrl);
      setCvFile(file);
      toast.success("CV uploaded successfully.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Ensure 'resumes' bucket exists.");
    } finally {
      setUploadingCv(false);
    }
  };

  const TutorSteps = ["Profile & CV", "Subjects", "Rate & Bio"];
  const ParentSteps = ["Profile", "Children"];
  const CounselorSteps = ["Profile", "Bio"];

  const stepsList = role === "tutor" ? TutorSteps : role === "parent" ? ParentSteps : CounselorSteps;
  const isLastStep = step === stepsList.length;

  const handleNextOrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLastStep) {
      if (role === "tutor" && step === 1 && !cvUrl && !cvFile) {
        return toast.error("Please upload your CV before proceeding.");
      }
      setStep(step + 1);
      return;
    }

    if (role === "tutor" && subjects.length === 0) {
      return toast.error("Select at least one subject you teach.");
    }

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
        is_onboarded: true,
      };
      
      // We only update fullName if it's Parent/Counselor since Tutor doesn't ask for it
      if (role !== "tutor") {
        updates.full_name = fullName.trim();
      }

      if (role === "tutor") {
        updates.subjects = subjects;
        updates.hourly_rate = hourlyRate ? Number(hourlyRate) : null;
        updates.rate_currency = currency;
        updates.bio = bio.trim() || null;
        updates.resume_url = cvUrl || null;
      } else if (role === "counselor") {
        updates.bio = bio.trim() || null;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      // In real life, we would save `childrenDetails` to a database table here for Parent

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

  if (role === "student") {
    return <StudentDiagnosticOnboarding />;
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
                    step === i + 1 ? "bg-[#1099A1] text-white" : step > i + 1 ? "bg-[#1099A1] text-white" : "bg-[#e9edef] dark:bg-[#2a3942] text-[#54656f] dark:text-[#aebac1]"
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
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-[#1099A1] text-white rounded-full shadow-lg hover:bg-[#0d848b] transition">
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
                  <div>
                    <p className="text-[13px] font-medium text-[#111] dark:text-white mb-2">Preferred theme</p>
                    <div className="flex gap-3">
                      {(["light", "dark"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTheme(t)}
                          className={cn(
                            "flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors",
                            theme === t
                              ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1]"
                              : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                          )}
                        >
                          {t === "light" ? <Sun size={18} /> : <Moon size={18} />}
                          <span className="text-[14px] font-medium capitalize">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tutor Step 1: CV Upload (Already has Profile Image rendered above) */}
              {role === "tutor" && step === 1 && (
                <div className="flex flex-col gap-4">
                  <div className="p-6 border-2 border-dashed border-[#e9edef] dark:border-[#2a3942] rounded-xl flex flex-col items-center justify-center text-center bg-[#f8f9fa] dark:bg-[#1a2329] hover:bg-[#f1f3f5] dark:hover:bg-[#202c33] transition-colors cursor-pointer"
                       onClick={() => cvInputRef.current?.click()}>
                    {uploadingCv ? (
                      <Loader2 size={32} className="animate-spin text-[#1099A1] mb-2" />
                    ) : (
                      <FileUp size={32} className="text-[#1099A1] mb-2" />
                    )}
                    <h3 className="text-[#111] dark:text-white font-semibold text-[15px] mb-1">
                      Upload your CV / Resume
                    </h3>
                    <p className="text-[#54656f] dark:text-[#aebac1] text-[13px]">
                      PDF, DOCX, or Image (Max 5MB)
                    </p>
                    <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleCvUpload} />
                  </div>
                  
                  {cvFile && (
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={18} className="text-[#1099A1] flex-shrink-0" />
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

              {/* Tutor Step 2: Subjects */}
              {role === "tutor" && step === 2 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-medium text-[#111] dark:text-white">
                      Subjects you teach
                      {subjects.length > 0 && (
                        <span className="text-[#1099A1] font-semibold"> · {subjects.length}</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAllSubjects((v) => !v)}
                      className="text-[12px] font-medium text-[#1099A1] hover:text-[#0d848b] transition-colors"
                    >
                      {showAllSubjects ? "Show less" : `View all (${SUBJECTS.length})`}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(showAllSubjects ? SUBJECTS : SUBJECTS.slice(0, 3)).map((s) => {
                      const active = subjects.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSubject(s)}
                          className={cn(
                            "relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all",
                            active
                              ? "border-[#1099A1] ring-2 ring-[#1099A1]/30"
                              : "border-[#e9edef] dark:border-[#2a3942] hover:border-[#1099A1]/50"
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
                            <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#1099A1] text-white flex items-center justify-center">
                              <Check size={13} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tutor Step 3: Rate & Bio */}
              {role === "tutor" && step === 3 && (
                <>
                  <MoneyInput
                    label="Rate per session"
                    value={hourlyRate}
                    onChange={setHourlyRate}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                  />
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

              {/* Parent Step 2: Children (Google Drive Style) */}
              {role === "parent" && step === 2 && (
                <div className="flex flex-col gap-4">
                  <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mb-2">
                    Enter the emails of your children and select the services they will have access to.
                  </p>

                  {/* Top Input Area */}
                  <div className="flex gap-2">
                    <FloatingInput 
                      label="Child's email address"
                      value={newChildEmail}
                      onChange={(e) => setNewChildEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="button"
                      onClick={handleAddChild}
                      disabled={!newChildEmail.includes('@')}
                      className="bg-[#1099A1] hover:bg-[#0d848b] text-white h-[52px] px-6 rounded-xl font-medium"
                    >
                      Add
                    </Button>
                  </div>

                  {/* List of Added Children */}
                  {childrenDetails.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[13px] font-semibold text-[#111] dark:text-white mb-3 px-1">Children with access</p>
                      <div className="flex flex-col gap-2">
                        {childrenDetails.map((child, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#1099A1]/10 text-[#1099A1] flex items-center justify-center">
                                <User size={16} />
                              </div>
                              <span className="text-[14px] font-medium text-[#111] dark:text-white truncate max-w-[150px] sm:max-w-xs">{child.email}</span>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              {/* Service toggles */}
                              <div className="flex bg-[#f8f9fa] dark:bg-[#111b21] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
                                <button
                                  type="button"
                                  onClick={() => toggleChildService(idx, 'tutoring')}
                                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-all", child.services.includes('tutoring') ? "bg-white dark:bg-[#202c33] text-[#1099A1] shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                                >
                                  Tutoring
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleChildService(idx, 'admissions')}
                                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-all", child.services.includes('admissions') ? "bg-white dark:bg-[#202c33] text-[#1099A1] shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                                >
                                  Admissions
                                </button>
                              </div>

                              <button type="button" onClick={() => handleRemoveChild(idx)} className="p-2 text-[#8696a0] hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove">
                                <Trash size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Counselor Step 2: Bio */}
              {role === "counselor" && step === 2 && (
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
              
              <Button
                type="submit"
                className="px-8 h-11 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[14px] font-bold"
                disabled={loading}
              >
                {loading ? "Saving..." : isLastStep ? "Complete Setup" : "Next"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
"""

with open('src/pages/shared/OnboardingPage.tsx', 'w') as f:
    f.write(content)
