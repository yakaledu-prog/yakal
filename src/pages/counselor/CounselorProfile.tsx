import { useEffect, useState, useRef } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { DetailRow } from "@/components/shared/DetailRow";
import { ResumePanel } from "@/components/shared/ResumePanel";
import {
  TutorResume,
  resumeFromProfile,
  type ResumeSection,
} from "@/components/shared/TutorResume";
import { ResumeEntryDialog } from "@/components/shared/ResumeEntryDialog";
import {
  Edit2, Mail, Phone, Link2, Calendar, CheckCircle, Users, LogOut,
  Camera, X, Loader2, Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCounselorSessionsFull, SessionRow } from "@/services/counselorService";
import { MoneyInput, Currency } from "@/components/ui/MoneyInput";
import { dicebearUrl } from "@/utils/avatar";

const SUBJECTS = ["College Advising", "Financial Aid", "Essay Review", "SAT Prep", "Other"];

export function CounselorProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addingTo, setAddingTo] = useState<ResumeSection | null>(null);

  useEffect(() => {
    if (!user) return;
    getCounselorSessionsFull(user.id).then(setSessions);
  }, [user]);

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

  const avatarSrc = profile?.avatar_url || dicebearUrl(profile?.full_name || user?.id || "C");

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Header */}
        <div className="bg-primary text-white p-6 md:p-10 pb-0 md:pb-0 relative overflow-hidden shrink-0">
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
                    className="w-24 h-24 rounded-full overflow-hidden border border-white/20 bg-cover bg-center bg-no-repeat bg-black/50"
                    style={{ backgroundImage: `url(${avatarSrc})` }}
                  />
                  <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="text-white animate-spin" size={22} /> : <Camera className="text-white" size={24} />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">{profile?.full_name || "Counselor"}</h1>
                  {/* <span className="bg-white/20 text-white text-[12px] font-bold px-3 py-1 rounded-full mb-3 inline-block capitalize">{profile?.role}</span> */}
                  {profile?.bio && <p className="text-white/80 text-[14px] max-w-xl">{profile.bio}</p>}
                </div>
              </div>
              <div className="shrink-0 flex flex-col gap-3">
                <button onClick={() => setEditOpen(true)} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  <Edit2 size={16} /> Edit Profile
                </button>
                <button onClick={() => signOut()}
                  className="flex items-center justify-center gap-2 !bg-tertiary/40 border border-tertiary/40 hover:!bg-secondary/30 !text-white font-semibold h-11 px-4 rounded-lg transition-colors w-full md:w-auto">
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>

            {/* Bottom Row Stats in Header */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 pb-6">
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
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><Calendar size={14} /> Upcoming Sessions</p>
                  <p className="text-3xl font-bold">{sessions.filter((s) => s.status === "upcoming").length}</p>
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
                <DetailRow
                  icon={<Link2 size={18} />}
                  label="Session Link"
                  value={profile?.zoom_link || "Not set"}
                  copy={!!profile?.zoom_link}
                  truncate
                />
              </div>

              {/* The CV given at onboarding, and the thing an admin opened
                  before approving the account. It belongs somewhere a
                  counsellor can check and replace it rather than only inside
                  the application they can no longer see.

                  No rate row: a tier is priced by an admin, a counsellor does
                  not quote for one, so showing a rate here would imply a
                  negotiation that does not exist. */}
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
              {/* A counsellor's background, not their diary. Sessions have a
                  page of their own, and repeating six of them here answered a
                  question nobody opens a profile to ask. */}
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

function EditModal({ onClose }: { onClose: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [zoomLink, setZoomLink] = useState(profile?.zoom_link || "");
  const [rate, setRate] = useState(profile?.hourly_rate != null ? String(profile.hourly_rate) : "");
  const [currency, setCurrency] = useState<Currency>((profile?.rate_currency as Currency) || "ETB");
  const [subjects, setSubjects] = useState<string[]>(profile?.subjects || []);
  const [saving, setSaving] = useState(false);

  const toggle = (s: string) => setSubjects((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      zoom_link: zoomLink.trim() || null,
      hourly_rate: rate ? Number(rate) : null,
      rate_currency: currency,
      subjects,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile updated.");
    onClose();
  };

  const field = "w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary text-[14px]";
  const lbl = "text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942] sticky top-0 bg-white dark:bg-[#202c33]">
          <h2 className="text-[20px] font-bold text-[#111] dark:text-white">Edit Profile</h2>
          <button onClick={onClose} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><label className={lbl}>Full Name</label><input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1.5"><label className={lbl}>Phone</label><input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><label className={lbl}>Session Link (Zoom / Meet)</label><input className={field} value={zoomLink} onChange={(e) => setZoomLink(e.target.value)} placeholder="https://meet.google.com/..." /></div>
          <div className="space-y-1.5"><label className={lbl}>Rate per session</label>
            <MoneyInput label="Rate per session" value={rate} onChange={setRate} currency={currency} onCurrencyChange={setCurrency} />
          </div>
          <div className="space-y-1.5"><label className={lbl}>Bio</label><textarea className={cn(field, "h-auto py-2 resize-none")} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
          <div className="space-y-1.5">
            <label className={lbl}>Focus Areas</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => {
                const on = subjects.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggle(s)}
                    className={cn("px-3 py-1.5 rounded-full text-[12px] font-medium border flex items-center gap-1", on ? "border-primary bg-primary/10 text-primary" : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1]")}>
                    {on && <Check size={12} />}{s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] sticky bottom-0">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
          <Button onClick={save} disabled={saving} className="h-10 px-6 bg-primary hover:bg-primary-hover text-white font-bold">{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}
