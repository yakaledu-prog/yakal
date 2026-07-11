import { useEffect, useState, useRef } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import {
  Edit2, Mail, Phone, Link2, Calendar, CheckCircle, Users, LogOut,
  Camera, Moon, Sun, X, Loader2, Check,
} from "lucide-react";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabase";
import { getTutorSessionsFull, getTutorCourses, SessionRow } from "@/services/tutorService";
import { MoneyInput, Currency } from "@/components/ui/MoneyInput";
import { dicebearUrl } from "@/utils/avatar";

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "SAT Prep", "College Advising", "Other"];

function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TutorProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courseCount, setCourseCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTutorSessionsFull(user.id).then(setSessions);
    getTutorCourses(user.id).then((c) => setCourseCount(c.length));
  }, [user]);

  const stats = [
    { label: "Active Students", value: new Set(sessions.map((s) => s.student_id)).size, icon: <Users size={18} />, color: "text-primary", bg: "bg-primary/10" },
    { label: "Completed Sessions", value: sessions.filter((s) => s.status === "completed").length, icon: <CheckCircle size={18} />, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/10" },
    { label: "Assigned Courses", value: courseCount, icon: <Calendar size={18} />, color: "text-[#CAA25F]", bg: "bg-[#CAA25F]/10" },
  ];

  const recent = sessions.slice(0, 6);

  const toggleTheme = async () => {
    const isDark = document.documentElement.classList.toggle("dark");
    if (user?.id) await supabase.from("profiles").update({ theme: isDark ? "dark" : "light" }).eq("id", user.id);
  };

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
    <PageWrapper>
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left column */}
          <div className="w-full lg:w-[350px] space-y-6 shrink-0">
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-8 flex flex-col items-center text-center shadow-sm relative">
              <button onClick={() => setEditOpen(true)} className="absolute top-4 right-4 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white">
                <Edit2 size={18} />
              </button>

              <div className="relative mb-4 group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-[#111b21] shadow-lg">
                  <img src={avatarSrc} alt={profile?.full_name || "Tutor"} className="w-full h-full object-cover" />
                </div>
                <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 className="text-white animate-spin" size={22} /> : <Camera className="text-white" size={24} />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
              </div>

              <h2 className="text-[24px] font-bold text-[#111] dark:text-white mb-1">{profile?.full_name || "Tutor"}</h2>
              <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[12px] font-bold px-3 py-1 rounded-full mb-4 inline-block capitalize">{profile?.role}</span>
              {profile?.bio && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] mb-6">{profile.bio}</p>}
              <button onClick={() => setEditOpen(true)} className="w-full bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold h-12 rounded-xl transition-colors">Edit Profile</button>
            </div>

            {/* Details */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-6 shadow-sm space-y-4">
              <DetailRow icon={<Mail size={18} />} label="Email" value={profile?.email || user?.email || "-"} />
              <DetailRow icon={<Phone size={18} />} label="Phone" value={profile?.phone || "Not set"} />
              <DetailRow icon={<Link2 size={18} />} label="Session Link" value={profile?.zoom_link || "Not set"} truncate />
              <DetailRow
                icon={<span className="text-[13px] font-bold">{profile?.rate_currency === "USD" ? "$" : "Br"}</span>}
                label="Rate / session"
                value={profile?.hourly_rate != null ? `${profile.hourly_rate} ${profile.rate_currency || "ETB"}` : "Not set"}
              />
              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#f8f9fa] dark:bg-[#182329] rounded-lg shrink-0"><Sun size={18} className="text-[#54656f] dark:text-[#aebac1] block dark:hidden" /><Moon size={18} className="text-[#aebac1] hidden dark:block" /></div>
                <div className="flex-1">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5">Theme</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white capitalize">{document.documentElement.classList.contains("dark") ? "Dark" : "Light"} Mode</p>
                    <button onClick={toggleTheme} className="p-1.5 rounded-md hover:bg-[#e9edef] dark:hover:bg-[#111b21] text-[#54656f] dark:text-[#aebac1]">
                      <Moon size={16} className="hidden dark:block" /><Sun size={16} className="block dark:hidden" />
                    </button>
                  </div>
                </div>
              </div>
              {profile?.subjects && profile.subjects.length > 0 && (
                <div className="pt-2">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-2">Subjects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.subjects.map((s) => (
                      <span key={s} className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-[#e9edef] dark:border-[#2a3942]">
                <button onClick={() => signOut()} className="flex items-center justify-center gap-3 w-full p-2 py-3 rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold">
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex-1 w-full space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((s, i) => (
                <div key={i} className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[14px] font-medium text-[#54656f] dark:text-[#aebac1]">{s.label}</p>
                    <div className={cn("p-2 rounded-lg", s.bg, s.color)}>{s.icon}</div>
                  </div>
                  <h3 className={cn("text-[32px] font-bold", s.color)}>{s.value}</h3>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl shadow-sm overflow-hidden">
              <div className="px-8 py-4 border-b border-[#e9edef] dark:border-[#2a3942]">
                <h3 className="text-[15px] font-bold text-primary">Recent Sessions</h3>
              </div>
              <div className="p-2">
                {recent.length === 0 ? (
                  <p className="text-center text-[14px] text-[#54656f] dark:text-[#aebac1] py-10">No sessions yet.</p>
                ) : recent.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] rounded-xl border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
                    <div className="flex items-center gap-6 min-w-0">
                      <div className="text-center w-12 shrink-0">
                        <p className="text-[20px] font-bold text-[#111] dark:text-white leading-none">{formatDate(item.date).split(" ")[1]}</p>
                        <p className="text-[12px] font-medium text-[#54656f] dark:text-[#aebac1] mt-1">{formatDate(item.date).split(" ")[0]}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-[#111] dark:text-white truncate">{item.subject}</p>
                        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] mt-0.5">{item.student_name}</p>
                      </div>
                    </div>
                    <span className={cn("px-3 py-1 text-[12px] font-bold rounded-full capitalize shrink-0",
                      item.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        item.status === "upcoming" ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600 dark:bg-red-900/20")}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editOpen && <EditModal onClose={() => setEditOpen(false)} />}
    </PageWrapper>
  );
}

function DetailRow({ icon, label, value, truncate }: { icon: React.ReactNode; label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <div className="p-2 bg-[#f8f9fa] dark:bg-[#182329] rounded-lg shrink-0 text-[#54656f] dark:text-[#aebac1] w-9 h-9 flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5">{label}</p>
        <p className={cn("text-[14px] font-semibold text-[#111] dark:text-white", truncate && "truncate max-w-[220px]")}>{value}</p>
      </div>
    </div>
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
            <label className={lbl}>Subjects</label>
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
          <Button onClick={save} disabled={saving} className="h-10 px-6 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold">{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}
