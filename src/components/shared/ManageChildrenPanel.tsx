import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Clock, Loader2, Trash2, Link2, Check, Mail, Plus, ChevronRight, Star, Crown, Sparkle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getBilling, type CoursePackage } from "@/services/packageService";
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
import { getAdmissionsPlans } from "@/services/admissionsService";
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


/**
 * A service column: what is there, or a way to start it.
 *
 * Kept as one wrapper so the two columns cannot drift into different empty
 * states, which is what a tick and a dash used to be.
 */
function ServiceCell({
  empty,
  addHref,
  children,
}: {
  empty: boolean;
  addHref: string;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <Link
        to={addHref}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-[#1099A1] hover:underline"
      >
        <Plus size={14} /> Add
      </Link>
    );
  }
  return <>{children}</>;
}

/**
 * The courses a child is booked on, as one line.
 *
 * The tutors' faces and a count, because the row belongs to a table about who
 * your children are, not about what they study: three stacked cards per child
 * turned four rows into a page. The detail opens as a row of its own, so it
 * gets the full width rather than a column's worth.
 */
function CourseList({ courses }: { courses: CoursePackage[] }) {
  if (courses.length === 0) {
    return <span className="text-[13px] text-muted-foreground">Paid, no course yet</span>;
  }

  const faces = courses.slice(0, 3);

  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="flex shrink-0 items-center">
        {faces.map((c, i) => (
          <img
            key={c.courseId}
            src={c.tutorAvatarUrl || dicebearUrl(c.tutorName ?? c.courseTitle)}
            alt=""
            title={c.tutorName ?? c.courseTitle}
            className={cn(
              "h-7 w-7 rounded-full border-2 border-card object-cover",
              i > 0 && "-ml-2.5"
            )}
          />
        ))}
      </span>
      <span className="text-[13px] text-foreground">
        {courses.length} course{courses.length === 1 ? "" : "s"}
      </span>
    </span>
  );
}

/**
 * One booked course, shaped like a row rather than a card.
 *
 * A card inside a table row is two frames around the same thing. Face, then
 * what it is, then the numbers on the right, and only a rule between them.
 */
function CourseCard({ course }: { course: CoursePackage }) {
  const left = course.slotsPurchased - course.slotsCompleted;
  return (
    <div className="flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0">
      <img
        src={course.tutorAvatarUrl || dicebearUrl(course.tutorName ?? course.courseTitle)}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{course.courseTitle}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          {course.tutorName ?? "Tutor being assigned"}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[13px] text-foreground">
          {course.slotsPurchased > 0 ? `${left} of ${course.slotsPurchased} left` : "No sessions yet"}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {course.slotsUpcoming > 0 ? `${course.slotsUpcoming} booked` : "None booked"}
        </p>
      </div>
    </div>
  );
}

/**
 * The admissions tier, in its own colour.
 *
 * The three are ordered, and a parent comparing two children wants to see
 * which is on which without reading. Brand colours only, so the ladder is
 * green, then gold, then teal for the top one.
 */
const TIER_LOOK: Record<string, { colour: string; icon: React.ReactNode }> = {
  essential: { colour: "#97CE9D", icon: <Sparkle size={13} /> },
  premier: { colour: "#CAA25F", icon: <Star size={13} /> },
  elite: { colour: "#1099A1", icon: <Crown size={13} /> },
};

function TierChip({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-[13px] text-muted-foreground">Paid, no plan yet</span>;

  const look = TIER_LOOK[tier.trim().toLowerCase()] ?? {
    colour: "#1099A1",
    icon: <Star size={13} />,
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] font-medium"
      style={{ color: look.colour }}
    >
      {look.icon} {tier}
    </span>
  );
}

export function ManageChildrenPanel({ className }: { className?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  /** The invite whose link was just copied, so the button can confirm. */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<{ id: string; name: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Admissions plans, so the row can name the tier a child is on rather than
  // just saying "Active".
  const { data: billing } = useQuery({
    queryKey: ["billing", user?.id],
    queryFn: () => getBilling(user!.id),
    enabled: !!user?.id,
  });

  /** Booked courses per child, so a row can name them rather than tick. */
  const coursesFor = (childId: string) =>
    (billing?.packages ?? []).filter((p) => p.studentId === childId);

  const { data: plans } = useQuery({
    queryKey: ["admissions-plans", childIds.join(",")],
    queryFn: () => getAdmissionsPlans(childIds),
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

  /**
   * Asked, not done. Removing a child cuts the parent off from their sessions,
   * their college list and their messages, and the only way back is another
   * invitation the child has to accept. A trash icon a thumb can reach is not
   * enough on its own.
   */
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
      {/* One box around the field and the sentence that explains it, so the
          two read as one thing: what you type, and what typing it does. */}
      <div className="rounded-lg border border-border p-4">
        <div className="relative flex flex-col items-stretch gap-3 sm:flex-row">
          <div className="relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border px-3.5 transition-colors focus-within:border-[#1099A1]">
            <Mail size={17} className="shrink-0 text-muted-foreground" />
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
              className="w-full bg-transparent py-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
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
            className="shrink-0 rounded-lg bg-[#1099A1] px-7 py-3 text-[15px] font-medium tracking-wide text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
          >
            {adding ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send invitation"}
          </button>
        </div>

        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          Inviting a child links them to your account and lets them sign in. Services are added per
          child from their row below, and become active once paid for.
        </p>
      </div>

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
                  <th className="pb-2 text-left text-[14px] font-medium text-foreground">Children</th>
                  {SERVICES.map((s) => (
                    <th
                      key={s.key}
                      className={cn(
                        "pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
                        s.key === "tutoring" ? "w-[300px]" : "w-[160px]"
                      )}
                    >
                      {s.label}
                    </th>
                  ))}
                  <th className="w-[52px]" />
                </tr>
              </thead>
              <tbody>
                {children.map((c) => {
                  const courses = coursesFor(c.id);
                  const open = expandedId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => courses.length > 0 && setExpandedId(open ? null : c.id)}
                        className={cn(
                          "border-b border-border/30 last:border-0",
                          courses.length > 0 && "cursor-pointer hover:bg-muted/30"
                        )}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            {/* Only where there is something to open. A chevron on
                            a row that does nothing is a broken control. */}
                            <ChevronRight
                              size={15}
                              className={cn(
                                "shrink-0 text-muted-foreground transition-transform",
                                open && "rotate-90",
                                courses.length === 0 && "invisible"
                              )}
                            />
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

                        <td className="py-3 pr-4">
                          <ServiceCell
                            empty={!hasService(c.id, "tutoring")}
                            addHref={SERVICES[0].buyHref(c.id)}
                          >
                            <CourseList courses={courses} />
                          </ServiceCell>
                        </td>

                        <td className="py-3 pr-4">
                          <ServiceCell
                            empty={!hasService(c.id, "admissions")}
                            addHref={SERVICES[1].buyHref(c.id)}
                          >
                            <TierChip tier={plans?.get(c.id)?.tier.name ?? null} />
                          </ServiceCell>
                        </td>

                        <td className="py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setToRemove({ id: c.id, name: c.full_name });
                            }}
                            disabled={busyKey === `${c.id}:unlink`}
                            title={`Remove ${c.full_name}`}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-[#CAA25F] disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>

                      {open && (
                        <tr className="border-b border-border/30">
                          <td colSpan={4} className="py-1 pl-10 pr-2">
                            {courses.map((course) => (
                              <CourseCard key={course.courseId} course={course} />
                            ))}

                            {/* The same shape as a course row, so it reads as the
                            next one rather than a control bolted underneath.
                            It goes to the catalogue with the child already
                            chosen: buying for the wrong child is the expensive
                            mistake, and this is the one place the right one is
                            already known. */}
                            <Link
                              to={SERVICES[0].buyHref(c.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-3 py-2.5 text-muted-foreground transition-colors hover:text-[#1099A1]"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-border">
                                <Plus size={14} />
                              </span>
                              <span className="text-[13px]">Add another course for {c.full_name.split(" ")[0]}</span>
                            </Link>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

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
                        onClick={() => setToRemove({ id: p.student_id, name: p.full_name })}
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

      <ConfirmModal
        isOpen={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) void unlink(toRemove.id, toRemove.name);
          setToRemove(null);
        }}
        title="Remove child"
        message={`Remove ${toRemove?.name ?? "this child"} from your account? You will lose access to their sessions, college list and messages, and getting it back means sending another invitation for them to accept.`}
        confirmText="Remove"
        isDestructive
      />
    </div>
  );
}
