import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import toast from "react-hot-toast";
import { Moon, Sun, Check } from "lucide-react";
import { cn } from "@/utils/cn";

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "SAT Prep",
  "College Advising",
  "Other",
];

const GRADE_LEVELS = [
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "University Year 1",
  "University Year 2",
  "University Year 3",
  "University Year 4",
];

const inputClass =
  "w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-[#1099A1] transition-colors";
const labelClass =
  "block text-[13px] font-medium text-[#111] dark:text-white mb-1.5";

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const role = profile?.role ?? "student";

  // Common
  const [fullName, setFullName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [phone, setPhone] = useState("");

  // Tutor
  const [subjects, setSubjects] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [bio, setBio] = useState("");

  // Student
  const [gradeLevel, setGradeLevel] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setTheme((profile.theme as "light" | "dark") || "light");
      setPhone(profile.phone || "");
      setSubjects(profile.subjects || []);
      setHourlyRate(profile.hourly_rate != null ? String(profile.hourly_rate) : "");
      setZoomLink(profile.zoom_link || "");
      setBio(profile.bio || "");
      setGradeLevel(profile.grade_level || "");
    }
  }, [profile]);

  const toggleSubject = (s: string) => {
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const avatarSrc =
    profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      fullName || "User"
    )}&background=1099A1&color=fff`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Role-specific validation
    if (role === "tutor") {
      if (subjects.length === 0) {
        toast.error("Please select at least one subject you teach.");
        return;
      }
      if (!zoomLink.trim()) {
        toast.error("Please add your session link (Zoom/Google Meet).");
        return;
      }
    }

    setLoading(true);
    try {
      const updates: Record<string, unknown> = {
        full_name: fullName.trim(),
        theme,
        avatar_url: avatarSrc,
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

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      // Apply theme
      if (theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");

      const fresh = await refreshProfile();
      toast.success("Profile setup complete!");
      navigate(
        postAuthPath(fresh ?? { role, status: profile?.status ?? "active", is_onboarded: true })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const roleHeading: Record<string, string> = {
    tutor: "Set up your tutor profile",
    student: "Tell us about your studies",
    parent: "Complete your parent profile",
    counselor: "Complete your counselor profile",
    admin: "Complete your profile",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      <Card className="w-full max-w-[520px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-bold text-[#111] dark:text-white mb-2">
            Welcome to Yakal!
          </h1>
          <p className="text-[#54656f] dark:text-[#aebac1] text-[15px]">
            {roleHeading[role] ?? "Let's complete your profile setup"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar (initials-based, no upload in V1) */}
          <div className="flex flex-col items-center">
            <img
              src={avatarSrc}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover ring-4 ring-[#1099A1]/20 mb-2"
            />
            <span className="text-[12px] text-[#54656f] dark:text-[#aebac1]">
              Generated from your name
            </span>
          </div>

          {/* Full name — everyone */}
          <div>
            <label className={labelClass}>Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Phone — tutor / parent / counselor */}
          {(role === "tutor" || role === "parent" || role === "counselor") && (
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251..."
                className={inputClass}
              />
            </div>
          )}

          {/* Grade level — student */}
          {role === "student" && (
            <div>
              <label className={labelClass}>Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className={inputClass}
              >
                <option value="">Select your grade</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subjects — tutor (teaches) / student (interested in) */}
          {(role === "tutor" || role === "student") && (
            <div>
              <label className={labelClass}>
                {role === "tutor" ? "Subjects you teach" : "Subjects of interest"}
              </label>
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

          {/* Tutor-only: rate + session link + bio */}
          {role === "tutor" && (
            <>
              <div>
                <label className={labelClass}>Rate per session (ETB)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 500"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Session link (Zoom / Google Meet)</label>
                <input
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className={inputClass}
                />
                <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1.5">
                  This link is automatically shared with students for every session you host.
                </p>
              </div>
            </>
          )}

          {/* Bio — tutor / counselor */}
          {(role === "tutor" || role === "counselor") && (
            <div>
              <label className={labelClass}>Short Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell students about your experience and expertise..."
                className={cn(inputClass, "resize-none")}
              />
            </div>
          )}

          {/* Theme — everyone */}
          <div>
            <label className={labelClass}>Preferred Theme</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors",
                  theme === "light"
                    ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1]"
                    : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                )}
              >
                <Sun size={18} />
                <span className="text-[14px] font-medium">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors",
                  theme === "dark"
                    ? "border-[#1099A1] bg-[#1099A1]/10 text-[#1099A1]"
                    : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                )}
              >
                <Moon size={18} />
                <span className="text-[14px] font-medium">Dark</span>
              </button>
            </div>
          </div>

          {(role === "tutor" || role === "counselor") && (
            <p className="text-[12px] text-center text-[#54656f] dark:text-[#aebac1]">
              Your account will be reviewed by an administrator before activation.
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-12 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[15px] font-bold mt-2"
            disabled={loading}
          >
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
