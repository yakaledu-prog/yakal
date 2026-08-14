import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminDashboard, getPendingApprovals, approveUser, rejectUser } from "@/services/adminService";
import { money } from "@/services/billingService";
import { dicebearUrl } from "@/utils/avatar";
import {
  Loader2, Check, X, ChevronRight, Users, GraduationCap, BookOpen, Wallet,
  Library, CreditCard, Bell, UserCheck,
} from "lucide-react";
import { cn } from "@/utils/cn";

const ROLE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  student: { label: "Students", icon: <BookOpen size={16} /> },
  tutor: { label: "Tutors", icon: <GraduationCap size={16} /> },
  counselor: { label: "Counselors", icon: <GraduationCap size={16} /> },
  parent: { label: "Parents", icon: <Users size={16} /> },
  admin: { label: "Admins", icon: <Wallet size={16} /> },
};

export function AdminHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "Admin";

  const { data: dash, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboard });
  const { data: pending = [] } = useQuery({ queryKey: ["admin-pending"], queryFn: getPendingApprovals });

  async function act(id: string, approve: boolean) {
    const res = approve ? await approveUser(id) : await rejectUser(id, "Not approved");
    if (!res.success) return toast.error(res.error || "Action failed.");
    toast.success(approve ? "Approved." : "Rejected.");
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  const pendingCount = dash?.pendingApprovals ?? pending.length;

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Welcome banner */}
        <div className="bg-primary text-white relative overflow-hidden">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>
          <div className="relative z-10 max-w-[1440px] mx-auto p-6 md:p-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
                <p className="text-white/80 text-[15px]">
                  {pendingCount > 0
                    ? `${pendingCount} application${pendingCount > 1 ? "s" : ""} waiting for your review.`
                    : "Everything is running smoothly. No approvals pending."}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg">
                <ToolbarButton icon={<Users size={18} />} label="Users" onClick={() => navigate("/admin/users")} />
                <ToolbarButton icon={<Library size={18} />} label="Courses" onClick={() => navigate("/admin/courses")} />
                <ToolbarButton icon={<CreditCard size={18} />} label="Billing" onClick={() => navigate("/admin/billing")} />
                <div className="w-px h-6 bg-white/20 mx-2" />
                <ToolbarButton icon={<Bell size={18} />} label="Notifications" onClick={() => navigate("/admin/notifications")} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Users" value={dash?.totalUsers ?? "-"} onClick={() => navigate("/admin/users")} />
              <IntegratedStat label="Pending" value={pendingCount} alert={pendingCount > 0} />
              <IntegratedStat label="Sessions" value={dash?.totalSessions ?? "-"} />
              <IntegratedStat label="Revenue" value={dash ? money(dash.revenueCents) : "-"} onClick={() => navigate("/admin/billing")} />
              <IntegratedStat label="Outstanding" value={dash ? money(dash.outstandingCents) : "-"} onClick={() => navigate("/admin/billing")} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Pending approvals */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground">
                <UserCheck size={20} className="text-primary" /> Pending approvals
              </h2>
              <button onClick={() => navigate("/admin/users?role=tutor")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View all</button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : pending.length === 0 ? (
              <p className="text-muted-foreground text-[14px] py-4">No tutors or counselors awaiting approval.</p>
            ) : (
              <div className="space-y-2.5">
                {pending.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-4 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
                    <img src={u.avatar_url || dicebearUrl(u.full_name)} alt="" className="w-11 h-11 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{u.full_name}</p>
                      <p className="text-[12px] text-muted-foreground truncate capitalize">{u.role}{u.email ? ` - ${u.email}` : ""}</p>
                    </div>
                    <button onClick={() => act(u.id, true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary-hover">
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => act(u.id, false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[#c0392b] text-[12px] font-semibold hover:bg-[#c0392b]/5">
                      <X size={14} /> Reject
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Users by role */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground">
                <Users size={20} className="text-primary" /> Users by role
              </h2>
            </div>
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {Object.entries(ROLE_META).map(([role, meta]) => (
                <button
                  key={role}
                  onClick={() => navigate(`/admin/users?role=${role}`)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{meta.icon}</span>
                  <span className="flex-1 text-[14px] font-medium text-[#111] dark:text-white">{meta.label}</span>
                  <span className={cn("text-[15px] font-bold", (dash?.usersByRole[role] ?? 0) > 0 ? "text-[#111] dark:text-white" : "text-muted-foreground")}>
                    {dash?.usersByRole[role] ?? 0}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} className="p-2 rounded-md text-white/90 hover:bg-white/15 hover:text-white transition-colors">
      {icon}
    </button>
  );
}

function IntegratedStat({ label, value, alert, onClick }: { label: string; value: string | number; alert?: boolean; onClick?: () => void }) {
  return (
    <div className={cn("flex flex-col", onClick && "cursor-pointer hover:opacity-80 transition-opacity")} onClick={onClick}>
      <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-3xl font-bold", alert && "text-[#FFE08A]")}>{value}</p>
    </div>
  );
}
