import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getUsers, approveUser, rejectUser, deleteUser, type AdminUser } from "@/services/adminService";
import { dicebearUrl } from "@/utils/avatar";
import { Search, Loader2, Check, X, Eye, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { AdminUserViewModal } from "./AdminUserViewModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const ROLES = ["all", "student", "tutor", "counselor", "parent"];

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get("role") || "all";
  const [q, setQ] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", role],
    queryFn: () => getUsers(role),
  });

  const filtered = users.filter((u) => {
    // Hide admin role entirely
    if (u.role === "admin") return false;
    return u.full_name.toLowerCase().includes(q.toLowerCase()) || (u.email || "").toLowerCase().includes(q.toLowerCase());
  });

  const counts = users.reduce(
    (acc, u) => {
      acc.total++;
      if (u.status === "active") acc.active++;
      if (u.status === "pending") acc.pending++;
      return acc;
    },
    { total: 0, active: 0, pending: 0 }
  );

  async function act(u: AdminUser, approve: boolean) {
    const res = approve ? await approveUser(u.id) : await rejectUser(u.id, "Not approved");
    if (!res.success) return toast.error(res.error || "Action failed.");
    toast.success(approve ? "Approved." : "Rejected.");
    qc.invalidateQueries({ queryKey: ["admin-users", role] });
  }

  async function handleDeleteConfirm() {
    if (!userToDelete) return;
    const res = await deleteUser(userToDelete.id);
    if (!res.success) return toast.error(res.error || "Delete failed.");
    toast.success("User deleted.");
    qc.invalidateQueries({ queryKey: ["admin-users", role] });
    setUserToDelete(null);
  }

  function handleView(u: AdminUser) {
    setSelectedUser(u);
    setIsViewModalOpen(true);
  }

  function setRole(r: string) {
    if (r === "all") searchParams.delete("role");
    else searchParams.set("role", r);
    setSearchParams(searchParams, { replace: true });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          title="Users"
          subtitle="Manage accounts and approve applicants"
          stats={[
            { label: role === "all" ? "All users" : role, value: counts.total },
            { label: "Active", value: counts.active },
            { label: "Pending", value: counts.pending },
          ]}
        />

        <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[13px] font-semibold capitalize transition-colors",
                    role === r ? "bg-[#1099A1] text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or email"
                className="pl-9 pr-3 h-10 w-full sm:w-64 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-lg text-[14px] outline-none focus:border-[#1099A1]"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : (
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-4">
                  <img src={u.avatar_url || dicebearUrl(u.full_name)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">
                      <span>{u.full_name}</span>
                      {/* <span className="inline-block mx-1 font-thin text-muted">|</span> */}
                      {/* <span className="text-primary">{u.role}</span> */}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">{u.email || "-"}</p>
                  </div>
                  {(u.role === "tutor" || u.role === "counselor") && u.status !== "active" && (
                    <button onClick={() => act(u, true)} className="inline-flex items-center gap-1 tracking-wider px-2.5 py-1.5 rounded bg-[#1099A1] text-white text-[12px] hover:bg-[#0d848b]">
                      <Check size={13} /> Approve
                    </button>
                  )}
                  {(u.role === "tutor" || u.role === "counselor") && u.status === "pending" && (
                    <button onClick={() => act(u, false)} className="mr-4 inline-flex items-center gap-1.5 tracking-wider px-2.5 py-1.5 rounded dark:border-[#2a3942] bg-[#c0392b] text-white text-[12px] hover:bg-[#c0392b]/85">
                      <X size={13} /> Reject
                    </button>
                  )}


                  {/* <span className="text-center text-[12px] font-medium capitalize text-muted-foreground w-20 hidden sm:block">{u.role}</span> */}
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", statusColor[u.status] || "bg-muted text-muted-foreground")}>
                    {u.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleView(u)} className="p-1.5 rounded-md text-muted-foreground hover:bg-gray-100 dark:hover:bg-[#182329] transition-colors" title="View details">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => setUserToDelete(u)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete user">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="p-8 text-center text-[14px] text-muted-foreground">No users found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AdminUserViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        user={selectedUser}
      />

      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={
          <>
            Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>?
            They will lose access to their account immediately.
          </>
        }
        confirmText="Delete"
        isDestructive={true}
      />
    </PageWrapper>
  );
}
