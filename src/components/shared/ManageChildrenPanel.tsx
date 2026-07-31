import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLinkedChildren,
  getChildServices,
  getPendingChildLinks,
  requestChildLink,
  setChildService,
  type ServiceName,
} from "@/services/parentService";
import { supabase } from "@/lib/supabase";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// Adding children and choosing their services.
//
// Shared because the parent's onboarding step and the My Children page ask for
// exactly the same thing.
//
// A parent cannot simply attach themselves to an account: row level security
// lets them create the request, and only the student can accept it. So a new
// row shows as pending until the child agrees, and services can only be set
// after that, since the policy on child_services requires an active link.
// ============================================================

const SERVICES: { key: ServiceName; label: string }[] = [
  { key: "tutoring", label: "Tutoring" },
  { key: "admissions", label: "Admissions" },
];

export function ManageChildrenPanel({ className }: { className?: string }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [service, setService] = useState<ServiceName | "">("");
  const [adding, setAdding] = useState(false);
  const [busyChild, setBusyChild] = useState<string | null>(null);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-child-links", user?.id],
    queryFn: () => getPendingChildLinks(user!.id),
    enabled: !!user?.id,
  });

  const childIds = children.map((c) => c.id);
  const { data: services = [] } = useQuery({
    queryKey: ["children-services", childIds.join(",")],
    queryFn: () => getChildServices(childIds),
    enabled: childIds.length > 0,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["linked-children"] });
    await queryClient.invalidateQueries({ queryKey: ["pending-child-links"] });
    await queryClient.invalidateQueries({ queryKey: ["children-services"] });
  };

  const isOn = (studentId: string, s: ServiceName) =>
    services.some((r) => r.student_id === studentId && r.service === s && r.is_active);

  async function add() {
    if (!user) return;
    setAdding(true);
    try {
      const result = await requestChildLink(user.id, profile?.full_name ?? "A parent", email);
      if (!result.success) throw new Error(result.error);
      setEmail("");
      setService("");
      await refresh();
      toast.success("Request sent. It appears once your child accepts it.");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send that request");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(studentId: string, s: ServiceName) {
    setBusyChild(studentId);
    try {
      const result = await setChildService(studentId, s, !isOn(studentId, s));
      if (!result.success) throw new Error(result.error);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Could not change that");
    } finally {
      setBusyChild(null);
    }
  }

  async function unlink(studentId: string, name: string) {
    if (!user) return;
    setBusyChild(studentId);
    try {
      const { error } = await supabase
        .from("parent_student_links")
        .delete()
        .eq("parent_id", user.id)
        .eq("student_id", studentId);
      if (error) throw error;
      await refresh();
      toast.success(`${name} removed`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not remove that child");
    } finally {
      setBusyChild(null);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col sm:flex-row items-stretch gap-2 border border-border rounded-2xl p-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !adding && add()}
          placeholder="Child's email address"
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
        />
        <div className="hidden sm:block w-px bg-border" />
        <select
          value={service}
          onChange={(e) => setService(e.target.value as ServiceName | "")}
          className="bg-transparent px-3 py-2.5 text-[14px] text-foreground outline-none sm:w-[170px]"
        >
          <option value="">Select service</option>
          {SERVICES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={adding || !email.trim()}
          className="px-6 py-2.5 rounded-xl bg-[#1099A1] text-white text-[14px] font-semibold hover:bg-[#0d7f86] disabled:opacity-50 transition-colors shrink-0"
        >
          {adding ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Add"}
        </button>
      </div>

      <div>
        <h3 className="text-[14px] font-bold text-foreground mb-3">Children with access</h3>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-[#1099A1]" size={20} />
          </div>
        ) : children.length === 0 && pending.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-4">
            No children yet. Add one with their email address above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {children.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <img
                  src={c.avatar_url || dicebearUrl(c.full_name)}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground truncate">{c.full_name}</p>
                  <p className="text-[12.5px] text-muted-foreground truncate">
                    {c.grade_level ?? "Grade not set"}
                  </p>
                </div>

                <div className="flex items-center rounded-xl border border-border overflow-hidden shrink-0">
                  {SERVICES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggle(c.id, s.key)}
                      disabled={busyChild === c.id}
                      className={cn(
                        "px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50",
                        isOn(c.id, s.key)
                          ? "text-[#1099A1] bg-[#1099A1]/10"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => unlink(c.id, c.full_name)}
                  disabled={busyChild === c.id}
                  title={`Remove ${c.full_name}`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-[#CAA25F] hover:bg-muted/50 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}

            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 opacity-70">
                <img
                  src={p.avatar_url || dicebearUrl(p.full_name)}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground truncate">{p.full_name}</p>
                  <p className="text-[12.5px] text-muted-foreground truncate">{p.email}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#8a6a2a] dark:text-[#CAA25F] shrink-0">
                  <Clock size={13} />
                  {p.status === "rejected" ? "Declined" : "Waiting to accept"}
                </span>
                <button
                  onClick={() => unlink(p.student_id, p.full_name)}
                  disabled={busyChild === p.student_id}
                  title="Withdraw the request"
                  className="p-2 rounded-lg text-muted-foreground hover:text-[#CAA25F] hover:bg-muted/50 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
