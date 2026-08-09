import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Loader2, Trash2, Link2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLinkedChildren,
  getChildServices,
  getPendingChildLinks,
  searchStudentsByEmail,
  inviteChild,
  sendInviteEmail,
  inviteLink,
  isValidEmail,
  getPendingInvites,
  cancelInvite,
  type ServiceName,
  type StudentSuggestion,
} from "@/services/parentService";
import { supabase } from "@/lib/supabase";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// Inviting children and seeing what each one has.
//
// This does one job now: the family. It invites a child, shows who has been
// invited, and lists the linked children with the services they actually have.
//
// It no longer switches services on and off. Access follows payment: a service
// is active when it has been bought for that child (an enrolment, an admissions
// plan), so the columns here report that state and link to where a service is
// purchased rather than offering a checkbox that access does not really obey.
// The invitation is the relationship, not a purchase.
// ============================================================

// Where a parent goes to buy each service for a specific child. The child id
// travels in the URL so the purchase screen lands with them already chosen.
const SERVICES: { key: ServiceName; label: string; buyHref: (childId: string) => string }[] = [
  { key: "tutoring", label: "Tutoring", buyHref: (id) => `/parent/courses?student=${id}` },
  { key: "admissions", label: "Admissions", buyHref: (id) => `/parent/admissions?student=${id}` },
];

export function ManageChildrenPanel({ className }: { className?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  /** The invite whose link was just copied, so the button can confirm. */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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

  // Suggestions come from a SECURITY DEFINER function that needs five
  // characters and returns the address masked, so this confirms an address the
  // parent already knows rather than letting anyone browse for students.
  const { data: suggestions = [] } = useQuery({
    queryKey: ["student-suggestions", email.trim().toLowerCase()],
    queryFn: () => searchStudentsByEmail(email),
    enabled: email.trim().length >= 5,
    staleTime: 30_000,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["child-invites", user?.id],
    queryFn: () => getPendingInvites(user!.id),
    enabled: !!user?.id,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["linked-children"] });
    await queryClient.invalidateQueries({ queryKey: ["pending-child-links"] });
    await queryClient.invalidateQueries({ queryKey: ["children-services"] });
    await queryClient.invalidateQueries({ queryKey: ["child-invites"] });
  };

  const hasService = (studentId: string, s: ServiceName) =>
    services.some((r) => r.student_id === studentId && r.service === s && r.is_active);

  // The invitation is email only: it creates the relationship, not a purchase.
  // The link works whether or not the child has an account yet.
  async function sendInvite() {
    if (!user) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return toast.error("Enter your child's email address.");
    if (!isValidEmail(trimmed)) return toast.error("That does not look like an email address.");
    setAdding(true);
    try {
      const result = await inviteChild(user.id, trimmed);
      if (!result.success || !result.inviteId) {
        throw new Error(result.error ?? "Could not create the invitation.");
      }
      const mail = await sendInviteEmail(result.inviteId);
      setEmail("");
      await refresh();
      toast.success(
        mail.sent
          ? `Invitation sent to ${trimmed}.`
          : "Invitation created. Copy the link below to share it."
      );
    } catch (err: any) {
      toast.error(err.message ?? "Could not send that invitation");
    } finally {
      setAdding(false);
    }
  }

  async function copyLink(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  async function resend(id: string) {
    setBusyKey(`${id}:resend`);
    try {
      const mail = await sendInviteEmail(id);
      if (mail.sent) toast.success("Invitation resent.");
      else toast.error(mail.error ?? "Could not resend the invitation.");
    } finally {
      setBusyKey(null);
    }
  }

  async function cancelInvitation(id: string) {
    setBusyKey(`${id}:invite`);
    try {
      const result = await cancelInvite(id);
      if (!result.success) throw new Error(result.error);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Could not cancel that invitation");
    } finally {
      setBusyKey(null);
    }
  }

  async function unlink(studentId: string, name: string) {
    if (!user) return;
    setBusyKey(`${studentId}:unlink`);
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
      setBusyKey(null);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="relative flex flex-col sm:flex-row items-stretch gap-2 border border-border rounded-2xl p-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSuggestOpen(false);
              if (e.key === "Enter" && !adding) sendInvite();
            }}
            placeholder="Child's email address"
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestOpen && suggestions.length > 0}
            aria-autocomplete="list"
            className="w-full bg-transparent px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
          />

          {suggestOpen && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg dark:bg-[#202c33]">
              {suggestions.map((sug: StudentSuggestion) => (
                <li key={sug.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSuggestOpen(false)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <img
                      src={sug.avatar_url || dicebearUrl(sug.full_name)}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-foreground">
                        {sug.full_name}
                      </span>
                      <span className="block truncate text-[12px] italic text-muted-foreground">
                        {sug.masked_email}
                        {sug.grade_level ? ` - ${sug.grade_level}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={sendInvite}
          disabled={adding || !email.trim()}
          className="px-6 py-2.5 rounded-xl bg-[#1099A1] text-white text-[14px] font-semibold hover:bg-[#0d7f86] disabled:opacity-50 transition-colors shrink-0"
        >
          {adding ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send invitation"}
        </button>
      </div>

      <p className="-mt-3 text-[12.5px] text-muted-foreground">
        Inviting a child links them to your account and lets them sign in. Services are added per
        child from their row below, and turn on once paid for.
      </p>

      {invites.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-foreground">Pending invitations</p>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5"
              >
                <span className="min-w-0 text-[13.5px] text-muted-foreground">
                  <span className="break-all text-foreground">{inv.email}</span>
                  <span className="ml-2 inline-flex items-center gap-1 text-[12px]">
                    <Clock size={12} /> Invitation pending
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => copyLink(inv.id, inv.token)}
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1099A1] transition-colors hover:text-[#0d7f86]"
                  >
                    {copiedId === inv.id ? (
                      <>
                        <Check size={13} /> Copied
                      </>
                    ) : (
                      <>
                        <Link2 size={13} /> Copy link
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => resend(inv.id)}
                    disabled={busyKey === `${inv.id}:resend`}
                    className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {busyKey === `${inv.id}:resend` ? "Sending..." : "Resend"}
                  </button>
                  <button
                    onClick={() => cancelInvitation(inv.id)}
                    disabled={busyKey === `${inv.id}:invite`}
                    className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {busyKey === `${inv.id}:invite` ? "Cancelling..." : "Cancel invitation"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-[#1099A1]" size={20} />
          </div>
        ) : children.length === 0 && pending.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-4">
            No children yet. Invite one with their email address above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-2 text-left text-[14px] font-bold text-foreground">Children</th>
                  {SERVICES.map((s) => (
                    <th
                      key={s.key}
                      className="w-[150px] pb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {s.label}
                    </th>
                  ))}
                  <th className="w-[52px]" />
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr key={c.id} className="border-b border-border/30 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={c.avatar_url || dicebearUrl(c.full_name)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-foreground">
                            {c.full_name}
                          </p>
                          <p className="truncate text-[12.5px] text-muted-foreground">
                            {c.grade_level ?? "Grade not set"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {SERVICES.map((s) => (
                      <td key={s.key} className="py-3 text-center">
                        {hasService(c.id, s.key) ? (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1099A1]">
                            <Check size={14} /> Active
                          </span>
                        ) : (
                          <Link
                            to={s.buyHref(c.id)}
                            className="text-[13px] font-medium text-muted-foreground underline-offset-2 hover:text-[#1099A1] hover:underline"
                          >
                            Add
                          </Link>
                        )}
                      </td>
                    ))}

                    <td className="py-3 text-right">
                      <button
                        onClick={() => unlink(c.id, c.full_name)}
                        disabled={busyKey === `${c.id}:unlink`}
                        title={`Remove ${c.full_name}`}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-[#CAA25F] disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}

                {pending.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0 opacity-70">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.avatar_url || dicebearUrl(p.full_name)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-foreground">
                            {p.full_name}
                          </p>
                          <p className="truncate text-[12.5px] text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td colSpan={SERVICES.length} className="py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#8a6a2a] dark:text-[#CAA25F]">
                        <Clock size={13} />
                        {p.status === "rejected" ? "Declined" : "Waiting to accept"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => unlink(p.student_id, p.full_name)}
                        disabled={busyKey === `${p.student_id}:unlink`}
                        title="Withdraw the request"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-[#CAA25F] disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
