import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search, X } from "lucide-react";

import { Dropdown } from "@/components/ui/Dropdown";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import {
  FLAG_REASONS,
  getFlags,
  getReportedConversation,
  reopenFlag,
  setFlagStatus,
  type AdminFlag,
  type FlagStatus,
  getReportedMessageIds,
} from "@/services/reports";

// ============================================================
// Reported conversations.
//
// The list answers "what is waiting", and nothing more: who complained, about
// whom, what for, and how long it has sat there. Judging a report needs the
// conversation, and the conversation needs room, so it opens in a dialog
// rather than crushing the table into an accordion.
//
// The dialog shows the messages around the reported one, not the reported one
// alone. "Asked to pay by bank transfer" reads very differently depending on
// what came before it, and an admin deciding whether to act on somebody's
// livelihood should not have to guess.
//
// Closing a report records who closed it and how. Deleting the row would lose
// the fact that anyone looked, which is exactly what you want to know when the
// same pair turns up again.
// ============================================================

const STATUSES: { value: FlagStatus | "all"; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const REASON_LABEL = Object.fromEntries(FLAG_REASONS.map((r) => [r.value, r.label]));
const PER_PAGE = 8;

function when(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const STATUS_STYLE: Record<string, string> = {
  open: "text-[#8a6a2a] dark:text-[#CAA25F]",
  reviewed: "text-[#1099A1]",
  dismissed: "text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  reviewed: "Actioned",
  dismissed: "Dismissed",
};

function Person({
  person,
  role,
}: {
  person: { name: string; avatarUrl: string | null } | null;
  role?: string;
}) {
  if (!person) return <span className="text-[13px] text-muted-foreground">Unknown</span>;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <img
        src={person.avatarUrl || dicebearUrl(person.name)}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-foreground">{person.name}</p>
        {role && <p className="text-[11.5px] capitalize text-muted-foreground">{role}</p>}
      </div>
    </div>
  );
}

export function AdminReports() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [status, setStatus] = useState<FlagStatus | "all">("open");
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AdminFlag | null>(null);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["admin-flags", status],
    queryFn: () => getFlags(status),
  });

  const { data: openFlags = [] } = useQuery({
    queryKey: ["admin-flags", "open"],
    queryFn: () => getFlags("open"),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? flags.filter((f) =>
          [f.reporter.name, f.subject?.name, f.note, f.message?.text]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(q))
        )
      : flags;
    return [...rows].sort((a, b) =>
      newestFirst
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime()
    );
  }, [flags, query, newestFirst]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  async function decide(flag: AdminFlag, next: "reviewed" | "dismissed") {
    if (!user) return;
    const res = await setFlagStatus(flag.id, next, user.id);
    if (!res.success) return toast.error(res.error ?? "Could not update that report.");
    toast.success(next === "reviewed" ? "Marked actioned." : "Dismissed.");
    setOpen(null);
    await qc.invalidateQueries({ queryKey: ["admin-flags"] });
  }

  async function reopen(flag: AdminFlag) {
    const res = await reopenFlag(flag.id);
    if (!res.success) return toast.error(res.error ?? "Could not reopen that report.");
    toast.success("Back in the queue.");
    setOpen(null);
    await qc.invalidateQueries({ queryKey: ["admin-flags"] });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background dark:bg-[#111b21]">
        <AdminHeader
          title="Reports"
          subtitle="Review flagged conversations and take action."
          stats={[{ label: "Open reports", value: openFlags.length }]}
        />

        <div className="mx-auto max-w-[1440px] p-6 md:p-8">
          {/* Search, then the filter, then the sort order. */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 md:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search reports by keyword"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-[#1099A1]"
              />
            </div>

            <Dropdown
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              ariaLabel="Filter by status"
              options={STATUSES.map((s) => ({ value: s.value, label: `Status: ${s.label}` }))}
            />

            <Dropdown
              value={newestFirst ? "new" : "old"}
              onChange={(v) => setNewestFirst(v === "new")}
              ariaLabel="Sort order"
              options={[
                { value: "new", label: "Newest first" },
                { value: "old", label: "Oldest first" },
              ]}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-[14px] text-muted-foreground">
              {query
                ? "Nothing matches that."
                : status === "open"
                  ? "Nothing waiting. Reports appear here when somebody flags a conversation."
                  : "Nothing here."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Reported by", "About", "Reason", "Time", "Status", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((f) => (
                    <tr key={f.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Person person={f.reporter} role={f.reporter.role} />
                      </td>
                      <td className="px-4 py-3">
                        <Person person={f.subject} role={f.subject?.role} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] text-[#8a6a2a] dark:text-[#CAA25F]">
                          {f.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted-foreground">
                        {when(f.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn("text-[12.5px] font-medium", STATUS_STYLE[f.status])}
                        >
                          {STATUS_LABEL[f.status] ?? f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setOpen(f)}
                          className="rounded-lg border border-border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-muted/60"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] text-muted-foreground">
                Showing {(current - 1) * PER_PAGE + 1}-
                {Math.min(current * PER_PAGE, filtered.length)} of {filtered.length} reports
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={current <= 1}
                    aria-label="Previous page"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted/60 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        "h-8 min-w-8 rounded-lg border px-2 text-[12.5px] transition-colors",
                        n === current
                          ? "border-[#1099A1] font-semibold text-[#1099A1]"
                          : "border-border hover:bg-muted/60"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={current >= pageCount}
                    aria-label="Next page"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted/60 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {open && (
        <ReviewDialog
          flag={open}
          onClose={() => setOpen(null)}
          onDecide={decide}
          onReopen={reopen}
        />
      )}
    </PageWrapper>
  );
}

function ReviewDialog({
  flag,
  onClose,
  onDecide,
  onReopen,
}: {
  flag: AdminFlag;
  onClose: () => void;
  onDecide: (flag: AdminFlag, next: "reviewed" | "dismissed") => void;
  onReopen: (flag: AdminFlag) => void;
}) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["reported-conversation", flag.conversationId],
    queryFn: () => getReportedConversation(flag.conversationId, flag.message?.id ?? null),
  });

  // Which of these the scan had already caught on its own. A report the system
  // agrees with is worth reading before one it did not see, and an admin
  // cannot tell the two apart from the report alone.
  const { data: autoCaught } = useQuery({
    queryKey: ["auto-caught", flag.conversationId, messages.length],
    queryFn: () => getReportedMessageIds(messages.map((m) => m.id)),
    enabled: messages.length > 0,
  });

  const settled = flag.status !== "open";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Review report"
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-6 border-b border-border p-5">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Reported by
            </p>
            <Person person={flag.reporter} role={flag.reporter.role} />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              About
            </p>
            <Person person={flag.subject} role={flag.subject?.role} />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* The conversation, with the reported message picked out. Context is
            the point: one quoted line is rarely enough to judge. */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              {flag.message
                ? "Only the reported message is readable."
                : "This is a concern about the conversation rather than one message."}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === flag.reporter.id;
              return (
                <div
                  key={m.id}
                  className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}
                >
                  {!mine && (
                    <img
                      src={m.senderAvatarUrl || dicebearUrl(m.senderName)}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                      m.isFlagged
                        ? "border border-[#CAA25F] bg-[#CAA25F]/10"
                        : mine
                          ? "bg-[#1099A1]/10"
                          : "bg-card border border-border"
                    )}
                  >
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">
                      {m.text}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {m.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {m.isFlagged && " - reported"}
                      {autoCaught?.has(m.id) && " - picked up automatically"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-3 border-t border-border p-5">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Report tags
            </p>
            <p className="text-[13px] text-[#8a6a2a] dark:text-[#CAA25F]">
              {flag.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}
            </p>
          </div>

          {flag.note && (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                Reporter's note
              </p>
              <p className="rounded-xl bg-muted/40 p-3 text-[13px] leading-relaxed text-foreground">
                {flag.note}
              </p>
            </div>
          )}

        </div>

        {/* When it was filed sits with the actions rather than in the body. It
            is context for the decision, not part of the case. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
          <p
            className="text-[12.5px] text-muted-foreground"
            title={flag.createdAt.toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          >
            Reported {when(flag.createdAt)}
          </p>

          <div className="flex flex-wrap gap-2">
            {settled ? (
              <button
                onClick={() => onReopen(flag)}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
              >
                <RotateCcw size={15} /> Put back in the queue
              </button>
            ) : (
              <>
                <button
                  onClick={() => onDecide(flag, "dismissed")}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
                >
                  <X size={15} /> Dismiss
                </button>
                <button
                  onClick={() => onDecide(flag, "reviewed")}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
                >
                  <Check size={15} /> Mark actioned
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
