import { useEffect, useState, useRef } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { ResumePanel } from "@/components/shared/ResumePanel";
import {
  TutorResume,
  resumeFromProfile,
  type ResumeSection,
} from "@/components/shared/TutorResume";
import { ResumeEntryDialog } from "@/components/shared/ResumeEntryDialog";
import { cn } from "@/utils/cn";
import { DetailRow } from "@/components/shared/DetailRow";
import { tutorProfileCompleteness } from "@/config/tutorProfile";
import { Calendar, Camera, CheckCircle, Edit2, Loader2, LogOut, Mail, Phone, Star, Users, X , AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getTutorSessionsFull, getTutorCourses, getTutorRatings, type TutorRating, SessionRow } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "SAT Prep", "College Advising", "Other"];

export function TutorProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [addingTo, setAddingTo] = useState<ResumeSection | null>(null);

  /** Written straight through: one tap, one column, nothing to confirm. */
  async function toggleSubject(subject: string) {
    if (!user) return;
    const current: string[] = profile?.subjects ?? [];
    const next = current.includes(subject)
      ? current.filter((s) => s !== subject)
      : [...current, subject];
    const { error } = await supabase.from("profiles").update({ subjects: next }).eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
  }

  /** The database column behind each section. */
  const COLUMN: Record<ResumeSection, string> = {
    certifications: "certifications",
    education: "education",
    workExperience: "work_experience",
    languages: "languages",
  };

  /**
   * Write one section back whole.
   *
   * jsonb has no append, and a read-modify-write is fine here: nobody edits
   * their own CV from two tabs at once.
   */
  async function writeSection(section: ResumeSection, next: unknown[]) {
    if (!user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ [COLUMN[section]]: next })
      .eq("id", user.id);

    if (error) {
      toast.error("Could not save that.");
      return;
    }
    await refreshProfile?.();
  }

  function addEntry(entry: Record<string, string>) {
    if (!addingTo) return;
    const current = resumeFromProfile(profile)[addingTo] as unknown[];
    void writeSection(addingTo, [...current, entry]);
    setAddingTo(null);
  }

  function removeEntry(section: ResumeSection, index: number) {
    const current = resumeFromProfile(profile)[section] as unknown[];
    void writeSection(
      section,
      current.filter((_, i) => i !== index)
    );
  }
  const [editOpen, setEditOpen] = useState(false);
  const completeness = tutorProfileCompleteness(profile);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courseCount, setCourseCount] = useState(0);
  const [myRating, setMyRating] = useState<TutorRating | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTutorSessionsFull(user.id).then(setSessions);
    getTutorCourses(user.id).then((c) => setCourseCount(c.length));
    // The aggregate view, same as the one families see, so a tutor is looking
    // at the number that is being shown about them.
    getTutorRatings([user.id]).then((m) => setMyRating(m.get(user.id)));
  }, [user]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      await refreshProfile();
      toast.success("Photo updated.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const avatarSrc = profile?.avatar_url || dicebearUrl(profile?.full_name || user?.id || "T");

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0 md:pb-0 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="max-w-[1440px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10">
              <div className="flex items-center gap-6">
                <div className="relative group shrink-0">
                  <div
                    className="w-24 h-24 rounded-full overflow-hidden border border-white/20 bg-cover bg-center bg-no-repeat bg-black/10"
                    style={{ backgroundImage: `url(${avatarSrc})` }}
                  />
                  <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="text-white animate-spin" size={22} /> : <Camera className="text-white" size={24} />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">{profile?.full_name || "Tutor"}</h1>
                  {/* <span className="bg-white/20 text-white text-[12px] font-bold px-3 py-1 rounded-full mb-3 inline-block capitalize">{profile?.role}</span> */}
                  {profile?.bio && <p className="text-white/80 text-[14px] max-w-xl">{profile.bio}</p>}

                  {/* Framed as findability rather than as an unfinished form.
                      Nothing is blocked by this; it is the only thing that
                      asks, now that onboarding lets a tutor skip past it. */}
                  {!completeness.complete && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="mt-3 flex items-center gap-2 text-left text-[13px] text-white/90 underline-offset-4 hover:underline"
                    >
                      <AlertCircle size={15} className="shrink-0" />
                      Profile {completeness.percent}% complete. Students find you more easily with{" "}
                      {completeness.missing.map((m) => m.label.toLowerCase()).join(", ")}.
                    </button>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col gap-3">
                <button onClick={() => setEditOpen(true)} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  <Edit2 size={16} /> Edit Profile
                </button>
                <button onClick={() => signOut()}
                  className="flex items-center justify-center gap-2 !bg-[#97CE9D]/40 border border-[#97CE9D]/40 hover:!bg-[#CAA25F]/30 !text-white font-semibold h-11 px-4 rounded-lg transition-colors w-full md:w-auto">
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>

            {/* Bottom Row Stats in Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 pb-6">
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><Users size={14} /> Active Students</p>
                  <p className="text-3xl font-bold">{new Set(sessions.map((s) => s.student_id)).size}</p>
                </div>
              </div>
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><CheckCircle size={14} /> Completed Sessions</p>
                  <p className="text-3xl font-bold">{sessions.filter((s) => s.status === "completed").length}</p>
                </div>
              </div>
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><Calendar size={14} /> Assigned Courses</p>
                  <p className="text-3xl font-bold">{courseCount}</p>
                </div>
              </div>
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><Star size={14} /> Average Rating</p>
                  {/* A dash, not 0.0. Nobody has rated them yet, which is not
                      the same as being rated badly. */}
                  {myRating?.averageStars != null ? (
                    <p className="text-3xl font-bold">
                      {myRating.averageStars.toFixed(1)}
                      <span className="text-[14px] font-medium text-white/70"> ({myRating.ratingCount})</span>
                    </p>
                  ) : (
                    <p className="text-3xl font-bold text-white/50">-</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Below Banner */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10">
          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Details */}
            <div className="w-full lg:w-[320px] shrink-0 space-y-6">
              <h3 className="text-[16px] font-bold text-foreground">Contact Details</h3>
              <div className="space-y-4">
                <DetailRow
                  icon={<Mail size={18} />}
                  label="Email"
                  value={profile?.email || user?.email || "-"}
                  href={profile?.email || user?.email ? `mailto:${profile?.email || user?.email}` : undefined}
                  truncate
                />
                <DetailRow
                  icon={<Phone size={18} />}
                  label="Phone"
                  value={profile?.phone || "Not set"}
                  copy={!!profile?.phone}
                />
              </div>

              {/* The CV given at onboarding. It goes out with every course
                  application, so it belongs somewhere a tutor can check and
                  replace it rather than only inside the application.

                  No rate row: an admin prices a course, a tutor does not quote
                  for one, so showing a rate here would imply a negotiation
                  that does not exist. */}
              <div className="border-t border-border/60 pt-6">
                {user && (
                  <ResumePanel
                    userId={user.id}
                    resumePath={(profile as any)?.resume_url ?? null}
                    onReplaced={() => refreshProfile?.()}
                  />
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="flex-1 w-full space-y-6">
              {/* Its own section rather than a list inside the edit modal.
                  Subjects are what the catalog filters and searches on, so
                  they belong beside the rest of what a family reads, not
                  buried under a name and a phone number. */}
              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="text-[16px] font-bold text-foreground">Subjects</h3>
                  <span className="text-[12px] text-muted-foreground">
                    {(profile?.subjects?.length ?? 0)} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => {
                    const on = (profile?.subjects ?? []).includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void toggleSubject(s)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-xl border px-3.5 py-2 text-[13.5px] transition-colors",
                          on
                            ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1]"
                            : "border-border text-muted-foreground hover:border-[#1099A1] hover:text-foreground"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* A tutor's background, not their diary. Sessions already have
                  a page of their own, and repeating five of them here answered
                  a question nobody opens a profile to ask. What a family
                  actually reads before booking is this. */}
              <TutorResume
                resume={resumeFromProfile(profile)}
                onAdd={setAddingTo}
                onRemove={removeEntry}
              />
            </div>
          </div>
        </div>
      </div>

      {editOpen && <EditModal onClose={() => setEditOpen(false)} />}

      {addingTo && (
        <ResumeEntryDialog
          section={addingTo}
          onSave={addEntry}
          onClose={() => setAddingTo(null)}
        />
      )}
    </PageWrapper>
  );
}

/**
 * The tutor's own details.
 *
 * Same four fields it always had. What changed is the shape: it was a stack of
 * boxed rows with the subjects as a wall of toggle capsules, which made eight
 * subjects look like eight decisions of equal weight and left the name, the
 * thing people actually change, competing with them for attention.
 *
 * Now it reads top to bottom in the order somebody thinks: who you are, how to
 * reach you, what you say about yourself, what you teach. Subjects are a list
 * that is searched rather than scanned, so the section stops growing as the
 * catalogue does.
 */
function EditModal({ onClose }: { onClose: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    if (!fullName.trim()) return toast.error("A name is needed.");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile updated.");
    onClose();
  };

  const input =
    "w-full rounded-lg border border-[#e9edef] bg-transparent px-3 py-2.5 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#9aa5ab] focus:border-[#1099A1] dark:border-[#2a3942] dark:text-white";
  const lbl = "mb-2 block text-[12px] font-medium uppercase tracking-wider text-[#8696a0]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)] dark:bg-[#202c33]"
      >
        <div className="flex items-center justify-between px-7 pt-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#111] dark:text-white">Edit profile</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 text-[#8696a0] transition-colors hover:bg-[#f0f2f5] hover:text-[#111] dark:hover:bg-[#111b21] dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-7 py-6">
          <div>
            <label className={lbl}>Name</label>
            <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div>
            <label className={lbl}>Phone</label>
            <input
              className={input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className={lbl}>About</label>
            <textarea
              className={cn(input, "min-h-[104px] resize-y leading-relaxed")}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="How you teach, and who you teach best."
            />
            {/* The bio is what a family reads before booking, and the public
                listing hides a tutor whose bio is under eighty characters. */}
            <p className="mt-2 text-[12px] text-[#8696a0]">
              {bio.trim().length < 80
                ? `${80 - bio.trim().length} more characters before you appear on the public site.`
                : "Long enough to appear on the public site."}
            </p>
          </div>

        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#e9edef] px-7 py-4 dark:border-[#2a3942]">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-[13.5px] font-medium text-[#54656f] transition-colors hover:bg-[#f0f2f5] dark:text-[#aebac1] dark:hover:bg-[#111b21]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
