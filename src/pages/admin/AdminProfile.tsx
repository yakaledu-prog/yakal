import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Mail, Phone, LogOut, SquarePenIcon, X, Users, Wallet, UserCheck, Moon, Sun } from "lucide-react";
import { getAdminDashboard, getAllInvoices } from "@/services/adminService";
import { money } from "@/services/billingService";

function fmtDate(d?: string | null) {
  if (!d) return { day: "", mon: "" };
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return { day: "", mon: "" };
  return { day: dt.toLocaleDateString(undefined, { day: "2-digit" }), mon: dt.toLocaleDateString(undefined, { month: "short" }).toUpperCase() };
}

export function AdminProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  const { data: dash } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboard });
  const { data: invoices = [] } = useQuery({ queryKey: ["admin-invoices"], queryFn: getAllInvoices });

  const toggleTheme = async () => {
    const dark = document.documentElement.classList.toggle("dark");
    setIsDark(dark);
    if (user?.id) await supabase.from("profiles").update({ theme: dark ? "dark" : "light" }).eq("id", user.id);
  };

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

  const stats = [
    { label: "Total Users", value: dash?.totalUsers ?? "-", icon: <Users size={18} /> },
    { label: "Revenue", value: dash ? money(dash.revenueCents) : "-", icon: <Wallet size={18} /> },
    { label: "Pending Approvals", value: dash?.pendingApprovals ?? "-", icon: <UserCheck size={18} /> },
  ];

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

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 mt-10">
            {stats.map((s) => (
              <div key={s.label} className="p-6 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 text-white/80 mb-2 uppercase text-[12px] font-bold tracking-wider">{s.icon} {s.label}</div>
                <div className="text-3xl font-black tracking-tight">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lower content */}
        <div className="p-6 md:p-10 lg:p-12 mx-auto w-full max-w-[1400px] flex flex-col lg:flex-row gap-10">
          {/* Contact & Details */}
          <div className="w-full lg:w-[320px] shrink-0 space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Contact &amp; Details</h3>
            <div className="flex flex-col gap-6">
              <DetailRow icon={<Mail size={20} />} label="Email" value={user?.email || "-"} />
              <DetailRow icon={<Phone size={20} />} label="Phone Number" value={profile?.phone || "-"} />
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5 text-[#54656f] dark:text-[#aebac1]">{isDark ? <Moon size={20} /> : <Sun size={20} />}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5 uppercase tracking-wide">Appearance</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white">Dark mode</p>
                    <button onClick={toggleTheme}
                      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", isDark ? "bg-[#1099A1]" : "bg-gray-300 dark:bg-gray-700")}>
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", isDark ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>
                </div>
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

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 mt-0.5 text-[#54656f] dark:text-[#aebac1]">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5 uppercase tracking-wide">{label}</p>
        <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}
