import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FloatingInput, FloatingTextarea } from "@/components/ui/FloatingField";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { MoneyInput, Currency } from "@/components/ui/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { fireConfetti } from "@/utils/confetti";
import {
  avatarGallery, dicebearUrl, randomSeeds, AVATAR_SEEDS, AVATAR_STYLES,
  extractAccentColor, DEFAULT_ACCENT, rgba, RGB,
  initialsGallery, initialsAvatarUrl,
} from "@/utils/avatar";
import { toast } from "sonner";
import { Moon, Sun, Check, Upload, Shuffle, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import logoImg from "@/assets/images/logo.webp";
import subjMath from "@/assets/images/subject-algebra.webp";
import subjPhysics from "@/assets/images/subject-physics.webp";
import subjSat from "@/assets/images/subject-sat-prep.webp";
import subjAdvising from "@/assets/images/resource-book-session.webp";
import subjOther from "@/assets/images/about-offer.webp";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "SAT Prep", "College Advising", "Other",
];

const GRADE_LEVELS = [
  "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "University Year 1", "University Year 2", "University Year 3", "University Year 4",
];

// Local images where we have them; stock (with local fallback) for the rest.
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

  // Avatar gallery state, default to initials of the user's name.
  const [avatarStyle, setAvatarStyle] = useState("initials");
  const [seeds, setSeeds] = useState<string[]>(AVATAR_SEEDS.slice(0, 12));
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  // Common
  const [fullName, setFullName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Tutor
  const [subjects, setSubjects] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState<Currency>("ETB");
  const [zoomLink, setZoomLink] = useState("");
  const [bio, setBio] = useState("");

  // Student
  const [gradeLevel, setGradeLevel] = useState("");

  useEffect(() => {
    if (isPreview) {
      setAvatarUrl(initialsAvatarUrl(""));
      return;
    }
    if (profile) {
      setFullName(profile.full_name || "");
      setTheme((profile.theme as "light" | "dark") || "light");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || initialsAvatarUrl(profile.full_name || ""));
      setSubjects(profile.subjects || []);
      setHourlyRate(profile.hourly_rate != null ? String(profile.hourly_rate) : "");
      setCurrency((profile.rate_currency as Currency) || "ETB");
      setZoomLink(profile.zoom_link || "");
      setBio(profile.bio || "");
      setGradeLevel(profile.grade_level || "");
    }
  }, [profile, isPreview]);

  // Live theme toggle, the onboarding page itself reflects the choice.
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  // Tint the left panel + upload icon to match the selected avatar's colours.
  const [accent, setAccent] = useState<RGB>(DEFAULT_ACCENT);
  useEffect(() => {
    if (!avatarUrl) return;
    let cancelled = false;
    extractAccentColor(avatarUrl).then((c) => !cancelled && setAccent(c));
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  // Keep an initials avatar in sync with the typed name (preserving its colour).
  useEffect(() => {
    setAvatarUrl((prev) => {
      if (prev && prev.includes("/initials/")) {
        const bg = prev.match(/backgroundColor=([0-9a-fA-F]+)/)?.[1];
        return initialsAvatarUrl(fullName, bg);
      }
      return prev;
    });
  }, [fullName]);

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");

    // Preview / logged-out: just show it locally.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (role === "tutor") {
      if (subjects.length === 0) return toast.error("Select at least one subject you teach.");
      if (!zoomLink.trim()) return toast.error("Add your session link (Zoom / Google Meet).");
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
        full_name: fullName.trim(),
        theme,
        avatar_url: avatarUrl,
        is_onboarded: true,
      };
      if (role === "tutor") {
        updates.phone = phone.trim() || null;
        updates.subjects = subjects;
        updates.hourly_rate = hourlyRate ? Number(hourlyRate) : null;
        updates.rate_currency = currency;
        updates.zoom_link = zoomLink.trim();
        updates.bio = bio.trim() || null;
      } else if (role === "student") {
        updates.grade_level = gradeLevel || null;
      } else if (role === "counselor") {
        updates.phone = phone.trim() || null;
        updates.bio = bio.trim() || null;
      } else if (role === "parent") {
        updates.phone = phone.trim() || null;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      const fresh = await refreshProfile();
      const dest = postAuthPath(fresh ?? { role, status: profile?.status ?? "active", is_onboarded: true });
      // Celebrate, then transition. The canvas lives on <body>, so it keeps
      // playing across the route change and cleans itself up.
      fireConfetti();
      toast.success("Profile setup complete!");
      setTimeout(() => navigate(dest), 450);
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
  // Initials style: same initials, different colours. Other styles: varied seeds.
  const gallery =
    avatarStyle === "initials" ? initialsGallery(fullName) : avatarGallery(seeds, avatarStyle);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      <div className="w-full max-w-[960px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl overflow-hidden grid md:grid-cols-[minmax(0,380px)_1fr]">
        {/* ── Left: brand + avatar picker (solid neutral panel) ─── */}
        <div className="p-8 border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] flex flex-col bg-[#f7f7f7] dark:bg-[#1a2329]">
          {/* Selected avatar preview (circular) */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={avatarUrl}
                alt="Selected avatar"
                className="w-28 h-28 rounded-full object-cover bg-white transition-all duration-700 ease-in-out"
                style={{ boxShadow: `0 0 0 4px ${rgba(accent, 0.3)}` }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full text-white flex items-center justify-center shadow-md transition-colors duration-700 ease-in-out hover:brightness-95"
                style={{ backgroundColor: rgba(accent, 1) }}
                title="Upload your own photo"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
            <p className="text-[14px] font-semibold text-[#111] dark:text-white mt-3 truncate max-w-full capitalize">
              {fullName || "Your name"}
            </p>
            <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] capitalize">{role}</p>
          </div>

          {/* Style tabs */}
          <div className="mt-6 flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-medium text-[#54656f] dark:text-[#aebac1] uppercase tracking-wide">
              Pick an avatar
            </p>
            <button
              type="button"
              onClick={() => setSeeds(randomSeeds(12))}
              className="flex items-center gap-1.5 text-[12px] font-medium transition-all duration-300 ease-in-out hover:brightness-90"
              style={{ color: rgba(accent, 1) }}
              title="Shuffle"
            >
              <Shuffle size={14} /> Shuffle
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {AVATAR_STYLES.map((s) => {
              const active = s.id === avatarStyle;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setAvatarStyle(s.id)}
                  style={active ? { borderColor: rgba(accent, 1), backgroundColor: rgba(accent, 0.1) } : undefined}
                  className={cn(
                    "shrink-0 flex flex-col items-center gap-1 rounded-lg p-1.5 border transition-all duration-300 ease-in-out",
                    !active && "border-transparent hover:bg-black/[0.03] dark:hover:bg-white/5"
                  )}
                  title={s.label}
                >
                  <img
                    src={dicebearUrl("Yakal", s.id)}
                    alt={s.label}
                    className="w-8 h-8 rounded-md bg-white border border-[#e9edef] dark:border-[#2a3942]"
                  />
                  <span
                    className={cn("text-[10px]", !active && "text-[#54656f] dark:text-[#aebac1]")}
                    style={active ? { color: rgba(accent, 1), fontWeight: 600 } : undefined}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Gallery grid, square, bordered */}
          <div className="grid grid-cols-4 gap-2.5 mt-3">
            {gallery.map(({ seed, url }) => {
              const active = avatarUrl === url;
              return (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setAvatarUrl(url)}
                  style={
                    active
                      ? { borderColor: rgba(accent, 1), boxShadow: `0 0 0 2px ${rgba(accent, 0.35)}` }
                      : undefined
                  }
                  className={cn(
                    "aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 ease-in-out",
                    active
                      ? "scale-105"
                      : "border-[#e9edef] dark:border-[#2a3942] hover:border-[#1099A1]/50"
                  )}
                >
                  <img src={url} alt={seed} className="w-full h-full object-cover bg-white" />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: logo + heading + form (scrolls if it overflows) ── */}
        <div className="min-w-0 md:max-h-[88vh] md:overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-8 md:min-h-full flex flex-col">
            <div className="flex-1 flex flex-col justify-center gap-5">
              <div>
                <img src={logoImg} alt="Yakal" className="h-14 object-contain mb-3" />
                <h1 className="text-[24px] font-bold text-[#111] dark:text-white leading-tight">
                  {heading.title}
                </h1>
                {heading.sub && (
                  <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mt-1.5">{heading.sub}</p>
                )}
              </div>

              <FloatingInput
                label="Full name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="capitalize"
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
                <SelectMenu
                  label="Grade level"
                  value={gradeLevel}
                  onChange={setGradeLevel}
                  options={GRADE_LEVELS}
                />
              )}

              {role === "tutor" && (
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

              {role === "tutor" && (
                <>
                  <MoneyInput
                    label="Rate per session"
                    value={hourlyRate}
                    onChange={setHourlyRate}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                  />
                  <FloatingInput
                    label="Session link (Zoom / Google Meet)"
                    type="url"
                    value={zoomLink}
                    onChange={(e) => setZoomLink(e.target.value)}
                    hint="Shared with students for every session you host."
                  />
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
