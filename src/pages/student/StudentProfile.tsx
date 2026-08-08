import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Mail, Phone, Flag, LogOut, Camera, X, SquarePenIcon } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PastSessions, type SessionListItem } from "@/components/shared/SessionList";
import { getStudentSessions } from "@/services/sessions";
import { getApplication, upsertApplication, type CollegeApplication } from "@/services/collegeService";
import { gradYearFromGrade } from "@/config/admissionsCalendar";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { GRADE_LEVELS } from "@/config/grades";

/** The stored stage values, said the way a family would say them. */
const STAGE_LABELS: Record<string, string> = {
  research: "Researching",
  apply: "Applying",
  submitted: "Submitted",
  decisions: "Waiting on decisions",
  enrolled: "Enrolled",
};

/**
 * One labelled fact in the teal banner.
 *
 * Module level on purpose: a component declared inside the page body is a new
 * type on every render, so React throws the old subtree away and rebuilds it.
 */
function HeaderFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="text-white/70 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
        <p className="text-[14px] text-white truncate">{value || "Not set"}</p>
      </div>
    </div>
  );
}

export function StudentProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const qc = useQueryClient();

  // Stage, intended major and graduation year live on the college
  // application, not the profile, so they need their own read.
  const { data: app } = useQuery({
    queryKey: ["college-application", user?.id],
    queryFn: () => getApplication(user!.id),
    enabled: !!user?.id,
  });

  const { data: sessionRows = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: async () => {
      const { data } = await getStudentSessions(user!.id);
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  const sessions: SessionListItem[] = sessionRows.map((s: any) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    title: s.subject,
    personName: s.tutor_name ?? null,
    personAvatarUrl: s.tutor_avatar ?? null,
  }));

  const summary = [
    profile?.grade_level,
    app?.grad_year ? `Class of ${app.grad_year}` : null,
    app?.program_interest,
  ].filter(Boolean) as string[];

  // The form is opened from the profile, so it starts from what is stored
  // rather than from empty, and only writes what changed.
  const [form, setForm] = useState({ fullName: "", phone: "", gradeLevel: "", bio: "", major: "", stage: "" });
  const [saving, setSaving] = useState(false);

  function openEditor() {
    setForm({
      fullName: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      gradeLevel: profile?.grade_level ?? "",
      major: app?.program_interest ?? "",
      stage: app?.stage ?? "research",
      bio: profile?.bio ?? "",
    });
    setIsEditModalOpen(true);
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");
    try {
      const path = `${user.id}/${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: saveErr } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (saveErr) throw saveErr;
      await refreshProfile();
      toast.success("Photo updated.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      e.target.value = "";
    }
  };

  async function saveProfile() {
    if (!user) return;
    if (!form.fullName.trim()) return toast.error("A name is needed.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.fullName.trim(),
        phone: form.phone.trim() || null,
        grade_level: form.gradeLevel || null,
        bio: form.bio.trim() || null,
      })
      .eq("id", user.id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Major and stage live on the college application, and the graduation
    // year is re-derived rather than asked for: correcting the grade in
    // September has to move the year with it, or the roadmap keeps showing
    // last year's timeline.
    const appRes = await upsertApplication(user.id, {
      program_interest: form.major.trim() || null,
      stage: form.stage as CollegeApplication["stage"],
      grad_year: gradYearFromGrade(form.gradeLevel, new Date()) ?? app?.grad_year ?? null,
    });
    setSaving(false);
    if (!appRes.success) return toast.error(appRes.error || "Could not save your college details.");

    await refreshProfile();
    qc.invalidateQueries({ queryKey: ["college-application", user.id] });
    toast.success("Profile saved.");
    setIsEditModalOpen(false);
  }

  return (
    <PageWrapper>
      <div className="flex flex-col min-h-0 bg-background overflow-y-auto">
        {/* Teal Header */}
        <div className="bg-[#1099A1] text-white pt-8 md:pt-12 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 px-6 md:px-10 lg:px-12 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
            {/* Centered on a phone: stacked and left-aligned, the avatar sat
                in a wide empty band and read as misplaced rather than as a
                column. */}
            <div className="flex flex-col md:flex-row items-center md:items-center gap-6 text-center md:text-left">
              <div className="relative group cursor-pointer shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/20 bg-black/20">
                  <img
                    src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}
                    alt={profile?.full_name || "User"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" size={24} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              <div className="flex flex-col min-w-0 items-center md:items-start">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight truncate">
                  {profile?.full_name || "Student"}
                </h1>
                {/* The name alone left the avatar unbalanced. This is the
                    same three facts the roadmap runs on, said in one line. */}
                {summary.length > 0 && (
                  <p className="text-white/80 text-[14px] mt-1.5">{summary.join(" \u00b7 ")}</p>
                )}
                {profile?.bio && <p className="text-white/80 text-[14px] mt-3 max-w-xl">{profile.bio}</p>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
              <button
                onClick={openEditor}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold h-11 px-4 rounded-lg transition-colors backdrop-blur-sm w-full md:w-auto"
              >
                <SquarePenIcon size={16} /> Edit Profile
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center gap-2 !bg-[#97CE9D]/40 border border-[#97CE9D]/40 hover:!bg-[#CAA25F]/30 !text-white font-semibold h-11 px-4 rounded-lg transition-colors w-full md:w-auto"
              >
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>

          {/* Where the three stat cards were. Those read 3, 12 and 5 for
              everybody, because they were hardcoded. These are facts about
              the person, so they are worth the space and cannot go stale. */}
          <div className="relative z-10 mt-10 px-6 md:px-10 lg:px-12 pb-8 flex flex-wrap justify-center gap-x-20 gap-y-6">
            <HeaderFact icon={<Mail size={15} />} label="Email" value={user?.email} />
            <HeaderFact icon={<Phone size={15} />} label="Phone" value={profile?.phone} />
            <HeaderFact
              icon={<Flag size={15} />}
              label="Application stage"
              value={STAGE_LABELS[app?.stage ?? ""] ?? "Not set"}
            />
          </div>
        </div>

        {/* Lower Content */}
        <div className="p-6 md:p-10 lg:p-12 mx-auto w-full max-w-[1400px]">
          <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Recent Activity</h3>

          {/* The shared session rows, not a bespoke list. What was here read
              "1-on-1 Mentorship: Algebra" and four more for every student,
              hardcoded, and looked unlike sessions anywhere else in the app. */}
          <PastSessions
            sessions={sessions}
            isLoading={sessionsLoading}
            limit={6}
            emptyText="Nothing yet. Your finished sessions will show up here."
          />
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
              <h2 className="text-[20px] font-bold text-[#111] dark:text-white">Edit Profile</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Avatar Upload in Modal */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                    <img
                      src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="text-white" size={20} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">Click to update picture</p>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Email Address</label>
                <input
                  type="email"
                  defaultValue={user?.email || ""}
                  disabled
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] text-[#54656f] dark:text-[#aebac1] cursor-not-allowed opacity-70"
                />
              </div>

              {/* Grade was asked for at onboarding and then had nowhere to be
                  corrected, which matters every September. */}
              <SelectMenu
                label="Grade"
                value={form.gradeLevel}
                onChange={(v) => setForm((f) => ({ ...f, gradeLevel: v }))}
                options={[...GRADE_LEVELS]}
              />

              {/* These two used to be inputs in the roadmap banner. That page
                  is read-only now, so they are corrected here instead. */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Intended major</label>
                <input
                  value={form.major}
                  onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}
                  placeholder="e.g. Computer Science"
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary"
                />
              </div>

              <SelectMenu
                label="Application stage"
                value={STAGE_LABELS[form.stage] ?? ""}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    stage: Object.keys(STAGE_LABELS).find((k) => STAGE_LABELS[k] === v) ?? f.stage,
                  }))
                }
                options={Object.values(STAGE_LABELS)}
              />

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Optional"
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">About you</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  placeholder="What you are working on, what you find hard, anything a tutor should know."
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary resize-y leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                onClick={saveProfile}
                disabled={saving}
                className="h-10 px-6 bg-[#1099A1] hover:bg-[#1099A1]/90 text-white font-bold"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
