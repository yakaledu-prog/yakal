import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getAdminDashboard, getPendingApprovals, approveUser, rejectUser } from "@/services/adminService";
import { money } from "@/services/billingService";
import { dicebearUrl } from "@/utils/avatar";
import { Loader2, Check, X, ChevronRight, Users, GraduationCap, BookOpen, Wallet } from "lucide-react";
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

  const { data: dash, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboard });
  const { data: pending = [] } = useQuery({ queryKey: ["admin-pending"], queryFn: getPendingApprovals });

  async function act(id: string, approve: boolean) {
    const res = approve ? await approveUser(id) : await rejectUser(id, "Not approved");
    if (!res.success) return toast.error(res.error || "Action failed.");
    toast.success(approve ? "Approved." : "Rejected.");
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        <AdminHeader
          stats={[
            { label: "Users", value: dash?.totalUsers ?? "-" },
            { label: "Pending", value: dash?.pendingApprovals ?? "-" },
            { label: "Sessions", value: dash?.totalSessions ?? "-" },
            { label: "Revenue", value: dash ? money(dash.revenueCents) : "-" },
            { label: "Outstanding", value: dash ? money(dash.outstandingCents) : "-" },
          ]}
        />

        <div className="max-w-[1440px] mx-auto p-6 md:p-10 grid lg:grid-cols-3 gap-6">
          {/* Pending approvals */}
          <div className="lg:col-span-2">
            <h2 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Pending approvals</h2>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#1099A1]" /></div>
            ) : pending.length === 0 ? (
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-8 text-center text-[14px] text-muted-foreground">
                No tutors or counselors awaiting approval.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pending.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-4 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
                    <img src={u.avatar_url || dicebearUrl(u.full_name)} alt="" className="w-11 h-11 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{u.full_name}</p>
                      <p className="text-[12px] text-muted-foreground truncate capitalize">{u.role}{u.email ? ` - ${u.email}` : ""}</p>
                    </div>
                    <button onClick={() => act(u.id, true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1099A1] text-white text-[12px] font-semibold hover:bg-[#0d848b]">
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
          <div>
            <h2 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Users by role</h2>
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {Object.entries(ROLE_META).map(([role, meta]) => (
                <button
                  key={role}
                  onClick={() => navigate(`/admin/users?role=${role}`)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#1099A1]/10 text-[#1099A1] flex items-center justify-center">{meta.icon}</span>
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
