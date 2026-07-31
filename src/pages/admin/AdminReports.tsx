import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Flag, Loader2, RotateCcw, X } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import {
  FLAG_REASONS,
  getFlags,
  reopenFlag,
  setFlagStatus,
  type AdminFlag,
  type FlagStatus,
} from "@/services/flagService";

// ============================================================
// Reported messages.
//
// A report is only worth filing if somebody acts on it, so this shows the
// message itself rather than a row saying one exists. Who complained, about
// whom, and what was actually said, without opening anything.
//
// Closing a report records who closed it and how, rather than deleting the
// row. Deleting would lose the fact that anybody looked, which is exactly what
// you want to know when the same pair is reported again.
// ============================================================

const TABS: { value: FlagStatus | "all"; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const REASON_LABEL = Object.fromEntries(FLAG_REASONS.map((r) => [r.value, r.label]));

function when(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Person({
  person,
  caption,
}: {
  person: { name: string; role: string; avatarUrl: string | null } | null;
  caption: string;
}) {
  if (!person) return null;
  return (
    <div className="flex items-center gap-2">
      <img
        src={person.avatarUrl || dicebearUrl(person.name)}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{caption}</p>
        <p className="truncate text-[13.5px] font-medium text-foreground">
          {person.name}
          <span className="ml-1.5 font-normal capitalize text-muted-foreground">{person.role}</span>
        </p>
      </div>
    </div>
  );
}

function ReportCard({
  flag,
  busy,
  onAction,
  onReopen,
}: {
  flag: AdminFlag;
  busy: boolean;
  onAction: (status: "reviewed" | "dismissed") => void;
  onReopen: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-4 dark:bg-[#182229] md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Person person={flag.reporter} caption="Reported by" />
          <Person person={flag.subject} caption="About" />
        </div>

        <div className="flex items-center gap-2">
          {flag.reasons.map((r) => (
            <span
              key={r}
              className="rounded-full bg-[#CAA25F]/15 px-2.5 py-1 text-[12px] font-medium text-[#8a6a2a] dark:text-[#CAA25F]"
            >
              {REASON_LABEL[r] ?? r}
            </span>
          ))}
          <span className="text-[12px] text-muted-foreground">{when(flag.createdAt)}</span>
        </div>
      </div>

      {/* The message itself, as it appeared. An admin should not have to open
          the conversation to see what the complaint is about. */}
      {flag.message ? (
        <blockquote className="rounded-xl rounded-bl-sm border border-border bg-muted/40 px-3.5 py-2.5">
          <p className="text-[13.5px] leading-snug text-foreground">{flag.message.text}</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {flag.subject?.name ?? "Sender"}
            {" - "}
            {flag.message.createdAt.toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </blockquote>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3.5 py-2.5 text-[13px] text-muted-foreground">
          A concern about the conversation as a whole, not one message.
        </p>
      )}

      {flag.note && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            What they said
          </p>
          <p className="mt-0.5 text-[13.5px] text-foreground">{flag.note}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
        {flag.status === "open" ? (
          <>
            <button
              onClick={() => onAction("dismissed")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
            >
              <X size={14} /> Dismiss
            </button>
            <button
              onClick={() => onAction("reviewed")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Mark actioned
            </button>
          </>
        ) : (
          <>
            <span
              className={cn(
                "text-[13px] font-medium",
                flag.status === "reviewed" ? "text-[#1099A1]" : "text-muted-foreground"
              )}
            >
              {flag.status === "reviewed" ? "Actioned" : "Dismissed"}
              {flag.reviewedAt && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {when(flag.reviewedAt)}
                </span>
              )}
            </span>
            <div className="flex-1" />
            <button
              onClick={onReopen}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
            >
              <RotateCcw size={14} /> Reopen
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function AdminReports() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<FlagStatus | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["admin-flags", tab],
    queryFn: () => getFlags(tab),
  });

  const { data: openFlags = [] } = useQuery({
    queryKey: ["admin-flags", "open"],
    queryFn: () => getFlags("open"),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-flags"] });

  async function act(flag: AdminFlag, status: "reviewed" | "dismissed") {
    if (!user) return;
    setBusyId(flag.id);
    const res = await setFlagStatus(flag.id, status, user.id);
    setBusyId(null);
    if (!res.success) return toast.error(res.error ?? "Could not update that report.");
    toast.success(status === "reviewed" ? "Marked as actioned" : "Dismissed");
    refresh();
  }

  async function reopen(flag: AdminFlag) {
    setBusyId(flag.id);
    const res = await reopenFlag(flag.id);
    setBusyId(null);
    if (!res.success) return toast.error(res.error ?? "Could not reopen that report.");
    refresh();
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-full bg-background pb-12 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-[#1099A1] px-6 pt-6 text-white md:px-10 md:pt-10">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path
              d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
          </svg>

          <div className="relative z-10 mx-auto max-w-[1000px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Reports</h1>
                <p className="pt-1 text-[15px] text-white/80">
                  Messages parents and students have asked the team to look at.
                </p>
              </div>
              <div className="pb-1 text-center">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                  Open
                </p>
                <p className="text-2xl font-medium">{openFlags.length}</p>
              </div>
            </div>

            <nav className="mt-6 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "whitespace-nowrap border-b-[3px] px-4 py-3 text-[14px] transition-colors",
                    tab === t.value
                      ? "border-white font-semibold text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-[1000px] p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : flags.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <Flag size={32} className="mx-auto mb-3 text-[#aebac1]" />
              <p className="text-[15px] font-medium text-foreground">
                {tab === "open" ? "Nothing waiting" : "Nothing here"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                {tab === "open"
                  ? "Reported messages appear here as soon as somebody sends one."
                  : "No reports with this status."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {flags.map((f) => (
                <ReportCard
                  key={f.id}
                  flag={f}
                  busy={busyId === f.id}
                  onAction={(status) => void act(f, status)}
                  onReopen={() => void reopen(f)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
