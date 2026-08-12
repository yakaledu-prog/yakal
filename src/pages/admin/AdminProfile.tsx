import React, { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  getSettings,
  saveSettings,
  SETTING_FIELDS,
  type SiteSettings,
} from "@/services/settingsService";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Mail, Phone, LogOut, SquarePenIcon, X } from "lucide-react";
import { getAllInvoices } from "@/services/adminService";
import { money } from "@/services/billingService";

function fmtDate(d?: string | null) {
  if (!d) return { day: "", mon: "" };
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return { day: "", mon: "" };
  return { day: dt.toLocaleDateString(undefined, { day: "2-digit" }), mon: dt.toLocaleDateString(undefined, { month: "short" }).toUpperCase() };
}

export function AdminProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const qc = useQueryClient();

  // Values the business owns, edited here rather than in an environment
  // variable that needs a redeploy to take effect.
  const { data: savedSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSettings,
    staleTime: Infinity,
  });
  // Only what has been typed, rather than a copy of the query. Mirroring the
  // whole thing into state needs an effect to seed it, which the compiler
  // rules count as a cascading render, and it goes stale the moment the query
  // refetches underneath.
  const [edits, setEdits] = useState<SiteSettings>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const settings: SiteSettings = { ...(savedSettings ?? {}), ...edits };

  // Something to save means an edit that differs from what is stored. Typing a
  // value and typing it back leaves the button inactive, which is correct:
  // there is nothing to write.
  const dirty = Object.entries(edits).some(
    ([k, v]) => v.trim() !== (savedSettings?.[k] ?? "").trim()
  );

  async function saveSiteSettings() {
    if (!user) return;
    setSavingSettings(true);
    const res = await saveSettings(settings, user.id);
    setSavingSettings(false);
    if (!res.success) return toast.error(res.error ?? "Could not save those.");
    toast.success("Settings saved.");
    setEdits({});
    qc.invalidateQueries({ queryKey: ["site-settings"] });
  }
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);

  const { data: invoices = [] } = useQuery({ queryKey: ["admin-invoices"], queryFn: getAllInvoices });

  const saveName = async () => {
    if (!user?.id || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved.");
    setEditOpen(false);
  };

  const activity = invoices.slice(0, 6);

  return (
    <PageWrapper>
      <div className="flex flex-col min-h-0 bg-background overflow-y-auto">
        {/* Teal header */}
        <div className="bg-[#1099A1] text-white pt-8 md:pt-12 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          </svg>

          <div className="relative z-10 px-6 md:px-10 lg:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/20 bg-black/20 shrink-0">
                <img src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`} alt={profile?.full_name || "Admin"} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col min-w-0">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight truncate">{profile?.full_name || "Administrator"}</h1>
                <p className="text-white/80 text-[14px] mt-3 max-w-xl">{profile?.bio || "Platform administrator overseeing users, courses, and billing."}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
              <button onClick={() => { setName(profile?.full_name || ""); setEditOpen(true); }}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold h-11 px-4 rounded-lg transition-colors backdrop-blur-sm w-full md:w-auto">
                <SquarePenIcon size={16} /> Edit Profile
              </button>
              <button onClick={() => signOut()}
                className="flex items-center justify-center gap-2 !bg-[#97CE9D]/40 border border-[#97CE9D]/40 hover:!bg-[#CAA25F]/30 !text-white font-semibold h-11 px-4 rounded-lg transition-colors w-full md:w-auto">
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>

          {/* Contact sits with the rest of who this person is, rather than in
              a column of its own below. The body is the settings form now. */}
          <div className="relative z-10 mt-8 flex flex-wrap gap-x-14 gap-y-5 border-t border-white/20 px-6 py-6 md:px-10 lg:px-12">
            <HeaderFact icon={<Mail size={15} />} label="Email" value={user?.email} />
            <HeaderFact icon={<Phone size={15} />} label="Phone" value={profile?.phone} />
          </div>
        </div>

        {/* Lower content */}
        <div className="p-6 md:p-10 lg:p-12 mx-auto w-full max-w-[1400px] flex flex-col lg:flex-row gap-10">
          {/* Contact, then the things this admin can change about the site.
              The dark mode toggle is gone: it is in the topbar and in the
              sidebar already, and it was the only thing in this column. */}
          <div className="w-full shrink-0 space-y-6 lg:w-[380px]">
            <div>
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Site settings</h3>

              <div className="mt-5 space-y-4">
                {SETTING_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label
                      htmlFor={`setting-${f.key}`}
                      className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium text-foreground"
                    >
                      {f.label}
                      <span className="font-normal text-[12px] text-muted-foreground">{f.hint}</span>
                    </label>
                    <input
                      id={`setting-${f.key}`}
                      type={f.type === "email" ? "email" : "text"}
                      value={settings[f.key] ?? ""}
                      onChange={(e) => setEdits((d) => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none transition-colors focus:border-[#1099A1]"
                    />
                  </div>
                ))}

                {/* The button or the sentence, never both: a disabled button
                    beside "all changes saved" says the same thing twice. */}
                {dirty || savingSettings ? (
                  <button
                    onClick={() => void saveSiteSettings()}
                    disabled={savingSettings}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
                  >
                    {savingSettings && <Loader2 size={14} className="animate-spin" />}
                    {savingSettings ? "Saving..." : "Save settings"}
                  </button>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground">All changes saved.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity (recent invoices) */}
          <div className="flex-1 w-full space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Recent Activity</h3>
            {activity.length === 0 ? (
              <p className="text-[14px] text-muted-foreground py-4">No billing activity yet.</p>
            ) : (
              <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                {activity.map((inv) => {
                  const d = fmtDate(inv.paid_at || inv.created_at);
                  const paid = inv.status === "paid";
                  return (
                    <div key={inv.id} className="flex flex-col sm:flex-row items-start sm:items-center py-6 gap-6 hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors -mx-4 px-4 rounded-xl">
                      <div className="flex flex-col items-center justify-center shrink-0 w-12 text-[#1099A1]">
                        <span className="text-[20px] font-bold leading-none mb-0.5">{d.day}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">{d.mon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-bold text-[#111] dark:text-white truncate mb-1">{inv.description}</h4>
                        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">{inv.parent_name} - {money(inv.amount_cents, inv.currency)}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={cn("text-[14px] font-bold capitalize", paid ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>{inv.status}</span>
                        <span className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1] w-20 text-right capitalize">{inv.kind}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
              <h2 className="text-[20px] font-bold text-[#111] dark:text-white">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Email Address</label>
                <input value={user?.email || ""} disabled
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] text-[#54656f] dark:text-[#aebac1] cursor-not-allowed opacity-70" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
              <Button onClick={saveName} disabled={saving} className="h-10 px-6 bg-[#1099A1] hover:bg-[#1099A1]/90 text-white font-bold">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

/**
 * One labelled fact in the teal banner. Module level: a component declared
 * inside the page body is a new type on every render, so React rebuilds it.
 */
function HeaderFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-white/70">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
        <p className="truncate text-[14px] text-white">{value || "Not set"}</p>
      </div>
    </div>
  );
}
