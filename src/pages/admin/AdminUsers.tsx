import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getUsers, approveUser, rejectUser, deleteUser, type AdminUser } from "@/services/adminService";
import { dicebearUrl } from "@/utils/avatar";
import { Search, Loader2, Check, X, Eye, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/utils/cn";
import { AdminUserViewModalTabbed } from "./AdminUserViewModalTabbed";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const ROLES = ["all", "student", "tutor", "counselor", "parent"];

type SortKey = "full_name" | "role" | "status" | "created_at" | "last_seen_at";

/** Every column an admin can order by, and how wide it wants to be. */
const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "full_name", label: "User" },
  { key: "role", label: "Role", className: "w-[110px]" },
  { key: "status", label: "Status", className: "w-[120px]" },
  { key: "created_at", label: "Joined", className: "w-[130px]" },
  { key: "last_seen_at", label: "Last seen", className: "w-[140px]" },
  { key: null, label: "", className: "w-[150px]" },
];

/** Plain coloured text, not a capsule. Status is a fact, not a badge. */
const STATUS_COLOR: Record<string, string> = {
  active: "#97CE9D",
  pending: "#CAA25F",
  rejected: "#c0392b",
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

  const [sort, setSort] = useState<{ by: SortKey; desc: boolean }>({ by: "created_at", desc: true });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = users.filter((u) => {
      // Hide admin role entirely
      if (u.role === "admin") return false;
      if (!needle) return true;
      return (
        u.full_name.toLowerCase().includes(needle) ||
        (u.email || "").toLowerCase().includes(needle) ||
        (u.phone || "").toLowerCase().includes(needle)
      );
    });

    // Nulls last whichever way it is sorted: an account that has never signed
    // in is not the most recent visitor, and it is not the oldest either.
    const value = (u: AdminUser) => {
      if (sort.by === "full_name") return u.full_name.toLowerCase();
      if (sort.by === "role") return u.role;
      if (sort.by === "status") return u.status;
      return u[sort.by] ?? "";
    };
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.desc ? -cmp : cmp;
    });
  }, [users, q, sort]);

  function toggleSort(by: SortKey) {
    // Dates read most-recent-first on the first click; names read A to Z.
    setSort((s) =>
      s.by === by ? { by, desc: !s.desc } : { by, desc: by === "created_at" || by === "last_seen_at" }
    );
  }

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
            /* A real table, because an admin scanning fifty accounts is
               comparing rows, and a stack of cards makes every comparison a
               scroll. Overflows sideways rather than squeezing the columns
               into unreadability on a narrow screen. */
            <div className="overflow-x-auto rounded-xl border border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#111b21]">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#e9edef] dark:border-[#2a3942]">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.label || "actions"}
                        className={cn("px-4 py-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground", col.className)}
                      >
                        {col.key ? (
                          <button
                            onClick={() => toggleSort(col.key!)}
                            className="flex items-center gap-1 transition-colors hover:text-foreground"
                          >
                            {col.label}
                            {sort.by === col.key &&
                              (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                          </button>
                        ) : (
                          <span className="sr-only">Actions</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-[#e9edef] last:border-0 hover:bg-[#f8f9fa] dark:border-[#2a3942] dark:hover:bg-[#182229]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar_url || dicebearUrl(u.full_name)}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-[#111] dark:text-white">{u.full_name}</p>
                            <p className="truncate text-[12.5px] text-muted-foreground">{u.email || "-"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[13px] capitalize text-[#1099A1]">{u.role}</td>

                      <td className="px-4 py-3">
                        <span
                          className="text-[13px] font-medium capitalize"
                          style={{ color: STATUS_COLOR[u.status] ?? undefined }}
                        >
                          {u.status}
                        </span>
                        {u.status === "rejected" && u.rejection_reason && (
                          <p className="mt-0.5 truncate text-[12px] text-muted-foreground" title={u.rejection_reason}>
                            {u.rejection_reason}
                          </p>
                        )}
                      </td>

                      {/* The exact date on hover: "2 months ago" is the right
                          answer at a glance and the wrong one in a dispute. */}
                      <td className="px-4 py-3 text-[13px] text-muted-foreground" title={format(new Date(u.created_at), "d MMM yyyy, HH:mm")}>
                        {format(new Date(u.created_at), "d MMM yyyy")}
                      </td>

                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {u.last_seen_at ? (
                          <span title={format(new Date(u.last_seen_at), "d MMM yyyy, HH:mm")}>
                            {formatDistanceToNowStrict(new Date(u.last_seen_at), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">Never</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {(u.role === "tutor" || u.role === "counselor") && u.status !== "active" && (
                            <button
                              onClick={() => act(u, true)}
                              title="Approve"
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[#97CE9D]/15 hover:text-[#1099A1]"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {(u.role === "tutor" || u.role === "counselor") && u.status === "pending" && (
                            <button
                              onClick={() => act(u, false)}
                              title="Reject"
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            >
                              <X size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleView(u)}
                            title="View details"
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[#1099A1]/10 hover:text-[#1099A1]"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => setUserToDelete(u)}
                            title="Delete user"
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="p-8 text-center text-[14px] text-muted-foreground">No users found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AdminUserViewModalTabbed
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
