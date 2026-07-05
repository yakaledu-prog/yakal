import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FloatingInput, FloatingSelect, FloatingTextarea } from "@/components/ui/FloatingField";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { avatarGallery, dicebearUrl } from "@/utils/avatar";
import toast from "react-hot-toast";
import { Moon, Sun, Check, Upload, Plus, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import logoImg from "@/assets/images/logo.webp";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "SAT Prep", "College Advising", "Other",
];

const GRADE_LEVELS = [
  "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "University Year 1", "University Year 2", "University Year 3", "University Year 4",
];

const GALLERY = avatarGallery();
const INITIAL_GALLERY = 11;

interface OnboardingPageProps {
  /** When set, renders in preview mode (no auth, nothing saved) for a given role. */
  previewRole?: string;
}

export function OnboardingPage({ previewRole }: OnboardingPageProps = {}) {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPreview = !!previewRole;
  const role = previewRole ?? profile?.role ?? "student";

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [galleryCount, setGalleryCount] = useState(INITIAL_GALLERY);

  // Common
  const [fullName, setFullName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Tutor
  const [subjects, setSubjects] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [bio, setBio] = useState("");

  // Student
  const [gradeLevel, setGradeLevel] = useState("");

  useEffect(() => {
    if (isPreview) {
      setFullName("Preview User");
      setAvatarUrl(dicebearUrl("Preview User"));
      return;
    }
    if (profile) {
      setFullName(profile.full_name || "");
      setTheme((profile.theme as "light" | "dark") || "light");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || dicebearUrl(profile.full_name || profile.id));
      setSubjects(profile.subjects || []);
      setHourlyRate(profile.hourly_rate != null ? String(profile.hourly_rate) : "");
      setZoomLink(profile.zoom_link || "");
      setBio(profile.bio || "");
      setGradeLevel(profile.grade_level || "");
    }
  }, [profile, isPreview]);

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isPreview || !user) {
      toast.error("Log in to upload a custom photo. Using generated avatars in preview.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please choose an image under 2 MB.");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (role === "tutor") {
      if (subjects.length === 0) return toast.error("Select at least one subject you teach.");
      if (!zoomLink.trim()) return toast.error("Add your session link (Zoom / Google Meet).");
    }

    if (isPreview) {
      toast.success("Looks good! (Preview mode — nothing was saved.)");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const updates: Record<string, unknown> = {
        full_name: fullName.trim(),
        theme,
        avatar_url: avatarUrl,
        is_onboarded: true,
      };
      if (role === "tutor") {
        updates.phone = phone.trim() || null;
        updates.subjects = subjects;
        updates.hourly_rate = hourlyRate ? Number(hourlyRate) : null;
        updates.zoom_link = zoomLink.trim();
        updates.bio = bio.trim() || null;
      } else if (role === "student") {
        updates.grade_level = gradeLevel || null;
        updates.subjects = subjects;
      } else if (role === "counselor") {
        updates.phone = phone.trim() || null;
        updates.bio = bio.trim() || null;
      } else if (role === "parent") {
        updates.phone = phone.trim() || null;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      if (theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");

      const fresh = await refreshProfile();
      toast.success("Profile setup complete!");
      navigate(postAuthPath(fresh ?? { role, status: profile?.status ?? "active", is_onboarded: true }));
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const roleHeading: Record<string, { title: string; sub: string }> = {
    tutor: { title: "Set up your tutor profile", sub: "Students will see this when booking sessions with you." },
    student: { title: "Tell us about your studies", sub: "We'll tailor tutors and courses to your goals." },
    parent: { title: "Complete your parent profile", sub: "You'll link your children's accounts in the next step." },
    counselor: { title: "Complete your counselor profile", sub: "Students will see this on their College Guide applications." },
    admin: { title: "Complete your profile", sub: "" },
  };
  const heading = roleHeading[role] ?? roleHeading.student;
  const showChips = role === "tutor" || role === "student";
  const visibleGallery = GALLERY.slice(0, galleryCount);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      {isPreview && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1099A1] text-white text-[12px] font-semibold px-3 py-1.5 rounded-full shadow">
          Preview: {role} onboarding — nothing is saved
        </div>
      )}

      <div className="w-full max-w-[960px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl overflow-hidden grid md:grid-cols-[minmax(0,380px)_1fr]">
        {/* ── Left: brand + avatar picker ─────────────────────────── */}
        <div className="bg-gradient-to-b from-[#1099A1]/8 to-transparent dark:from-[#1099A1]/12 p-8 border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] flex flex-col">
          <img src={logoImg} alt="Yakal" className="h-9 object-contain self-start mb-6" />

          <h1 className="text-[22px] font-bold text-[#111] dark:text-white leading-tight">
            {heading.title}
          </h1>
          {heading.sub && (
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mt-1.5">{heading.sub}</p>
          )}

          {/* Selected avatar preview */}
          <div className="flex flex-col items-center mt-7">
            <div className="relative">
              <img
                src={avatarUrl}
                alt="Selected avatar"
                className="w-28 h-28 rounded-full object-cover ring-4 ring-[#1099A1]/25 bg-white"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-[#1099A1] hover:bg-[#0d848b] text-white flex items-center justify-center shadow-md transition-colors"
                title="Upload your own photo"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
            <p className="text-[14px] font-semibold text-[#111] dark:text-white mt-3 truncate max-w-full">
              {fullName || "Your name"}
            </p>
            <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] capitalize">{role}</p>
          </div>

          {/* Avatar gallery */}
          <div className="mt-6">
            <p className="text-[12px] font-medium text-[#54656f] dark:text-[#aebac1] mb-2.5 uppercase tracking-wide">
              Pick an avatar
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {visibleGallery.map(({ seed, url }) => {
                const active = avatarUrl === url;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={cn(
                      "aspect-square rounded-full overflow-hidden border-2 transition-all",
                      active
                        ? "border-[#1099A1] ring-2 ring-[#1099A1]/30 scale-105"
                        : "border-transparent hover:border-[#1099A1]/40"
                    )}
                  >
                    <img src={url} alt={seed} className="w-full h-full object-cover bg-white" />
                  </button>
                );
              })}
              {galleryCount < GALLERY.length && (
                <button
                  type="button"
                  onClick={() => setGalleryCount(GALLERY.length)}
                  className="aspect-square rounded-full border-2 border-dashed border-[#1099A1]/40 text-[#1099A1] flex items-center justify-center hover:bg-[#1099A1]/5 transition-colors"
                  title="Show more"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: form ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5 md:max-h-[86vh] md:overflow-y-auto">
          <FloatingInput
            label="Full name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          {(role === "tutor" || role === "parent" || role === "counselor") && (
            <FloatingInput
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}

          {role === "student" && (
            <FloatingSelect
              label="Grade level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            >
              <option value=""></option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </FloatingSelect>
          )}

          {showChips && (
            <div>
              <p className="text-[13px] font-medium text-[#111] dark:text-white mb-2">
                {role === "tutor" ? "Subjects you teach" : "Subjects of interest"}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => {
                  const active = subjects.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={cn(
                        "px-3 py-2 rounded-full text-[13px] font-medium border flex items-center gap-1.5 transition-colors",
                        active
                          ? "border-[#1099A1] bg-[#1099A1]/10 text-[#1099A1]"
                          : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                      )}
                    >
                      {active && <Check size={14} />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {role === "tutor" && (
            <>
              <FloatingInput
                label="Rate per session (ETB)"
                type="number"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
              <div>
                <FloatingInput
                  label="Session link (Zoom / Google Meet)"
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                />
                <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1.5 px-1">
                  Shared with students for every session you host.
                </p>
              </div>
            </>
          )}

          {(role === "tutor" || role === "counselor") && (
            <FloatingTextarea
              label="Short bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          )}

          {/* Theme */}
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

          {(role === "tutor" || role === "counselor") && (
            <p className="text-[12px] text-[#54656f] dark:text-[#aebac1]">
              Your account will be reviewed by an administrator before activation.
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-12 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[15px] font-bold mt-1"
            disabled={loading}
          >
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
