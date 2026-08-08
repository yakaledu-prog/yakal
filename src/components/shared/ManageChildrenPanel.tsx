import { useState } from "react";
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
  setChildService,
  type ServiceName,
  type StudentSuggestion,
} from "@/services/parentService";
import { supabase } from "@/lib/supabase";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { Dropdown } from "@/components/ui/Dropdown";

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

/**
 * The on/off control for one service.
 *
 * A drawn tick rather than an icon in a box: the stroke animates in, so
 * turning something on reads as an action rather than a repaint, and the empty
 * state is a plain outline instead of an invisible glyph.
 */
function ServiceTick({
  on,
  busy,
  label,
  onClick,
}: {
  on: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? "Switch off" : "Switch on"}
      className={cn(
        "mx-auto grid h-10 w-10 place-items-center rounded-full transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1099A1] focus-visible:ring-offset-2",
        busy && "opacity-60",
        on
          ? "bg-[#1099A1] text-white shadow-sm hover:bg-[#0d848b]"
          : "border-2 border-dashed border-[#c2c7d0] text-[#c2c7d0] hover:border-[#1099A1] hover:text-[#1099A1] dark:border-[#3a4a52]"
      )}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 12.5 L9.5 17.5 L19.5 6.5"
          stroke="currentColor"
          strokeWidth={on ? 3.2 : 2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Drawn on, wiped off. 30 is a little over the path length, so the
          // dash clears it completely at either end.
          strokeDasharray="30"
          strokeDashoffset={on ? 0 : 30}
          className="transition-[stroke-dashoffset,stroke-width] duration-300 ease-out"
        />
      </svg>
    </button>
  );
}

/** The scope a link grants. "both" expands to the two service names on send. */
type Scope = ServiceName | "both";
const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "both", label: "Both services" },
  { value: "tutoring", label: "Tutoring only" },
  { value: "admissions", label: "Admissions only" },
];
const scopeToServices = (s: Scope): ServiceName[] =>
  s === "both" ? ["tutoring", "admissions"] : [s];

export function ManageChildrenPanel({ className }: { className?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("both");
  const [adding, setAdding] = useState(false);
  /** The invite whose link was just copied, so the button can confirm. */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Keyed by child and service. Keying by child alone disabled both ticks in
  // the row, so toggling one made the other flicker as though it had changed
  // too.
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

  const isOn = (studentId: string, s: ServiceName) =>
    services.some((r) => r.student_id === studentId && r.service === s && r.is_active);

  // One action for both cases. The link that goes out works whether or not the
  // child already has an account: a new child signs up through it, an existing
  // one is linked on the spot. So there is no "does this address exist" branch
  // and no dead end for a parent whose child has not joined yet.
  async function sendInvite() {
    if (!user) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return toast.error("Enter your child's email address.");
    // Caught here too, not just in the service, so a mistyped address like a
    // name with a space fails before a row is ever created.
    if (!isValidEmail(trimmed)) return toast.error("That does not look like an email address.");
    setAdding(true);
    try {
      const result = await inviteChild(user.id, trimmed, scopeToServices(scope));
      if (!result.success || !result.inviteId) {
        throw new Error(result.error ?? "Could not create the invitation.");
      }
      const mail = await sendInviteEmail(result.inviteId);
      setEmail("");
      setScope("both");
      await refresh();
      if (mail.sent) {
        toast.success(`Invitation link sent to ${trimmed}.`);
      } else {
        // The invite exists regardless; the parent can copy the link from the
        // list below. Say so rather than implying nothing happened.
        toast.success("Invitation created. Copy the link below to share it.");
      }
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

  async function withdrawInvite(id: string) {
    setBusyKey(`${id}:invite`);
    try {
      const result = await cancelInvite(id);
      if (!result.success) throw new Error(result.error);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Could not withdraw that invitation");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggle(studentId: string, s: ServiceName) {
    setBusyKey(`${studentId}:${s}`);
    try {
      const result = await setChildService(studentId, s, !isOn(studentId, s));
      if (!result.success) throw new Error(result.error);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Could not change that");
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
            // A blur that fires before the click would close the list out from
            // under the pointer, so it waits.
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
                    onClick={() => {
                      // The stored address is masked, so the field keeps what
                      // was typed. Picking a row confirms the person exists,
                      // it does not reveal an address.
                      setSuggestOpen(false);
                    }}
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
        <div className="hidden sm:block w-px bg-border" />
        <Dropdown
          value={scope}
          onChange={setScope}
          options={SCOPE_OPTIONS}
          ariaLabel="Which services the invitation grants"
          className="sm:w-[190px]"
          buttonClassName="border-0 bg-transparent font-normal"
        />
        <button
          onClick={sendInvite}
          disabled={adding || !email.trim()}
          className="px-6 py-2.5 rounded-xl bg-[#1099A1] text-white text-[14px] font-semibold hover:bg-[#0d7f86] disabled:opacity-50 transition-colors shrink-0"
        >
          {adding ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send invite link"}
        </button>
      </div>

      <p className="-mt-3 text-[12.5px] text-muted-foreground">
        We email your child a link that works whether or not they already have an account. Following
        it grants the services you chose.
      </p>

      {invites.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-foreground">Invited</p>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5"
              >
                <span className="min-w-0 text-[13.5px] text-muted-foreground">
                  <span className="break-all text-foreground">{inv.email}</span>
                  <span className="ml-2 text-[12px]">
                    {inv.services.length === 2
                      ? "both services"
                      : inv.services[0] === "admissions"
                        ? "admissions only"
                        : "tutoring only"}{" "}
                    - waiting to be accepted
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
                    onClick={() => withdrawInvite(inv.id)}
                    disabled={busyKey === `${inv.id}:invite`}
                    className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {busyKey === `${inv.id}:invite` ? "Withdrawing..." : "Withdraw"}
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
            No children yet. Add one with their email address above.
          </p>
        ) : (
          /* A table rather than a segmented control: which services a child has
             is a grid question, and a row of tinted pills made "on" and "off"
             look like two labels rather than two states. */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-2 text-left text-[14px] font-bold text-foreground">
                    Children with access
                  </th>
                  {SERVICES.map((s) => (
                    <th
                      key={s.key}
                      className="w-[110px] pb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
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

                    {SERVICES.map((s) => {
                      const on = isOn(c.id, s.key);
                      return (
                        <td key={s.key} className="py-3 text-center">
                          <ServiceTick
                            on={on}
                            busy={busyKey === `${c.id}:${s.key}`}
                            label={`${s.label} for ${c.full_name}`}
                            onClick={() => toggle(c.id, s.key)}
                          />
                        </td>
                      );
                    })}

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

                {/* Pending children have no services yet: the policy on
                    child_services needs an active link, so the columns would
                    only offer a toggle that cannot be saved. */}
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
