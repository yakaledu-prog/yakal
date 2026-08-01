import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Dropdown } from "@/components/ui/Dropdown";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { money as usd } from "@/services/billingService";
import {
  getTutorEarnings,
  methodLabel,
  requestSessionPayment,
  type EarningRow,
} from "@/services/payoutService";
import { cn } from "@/utils/cn";

// ============================================================
// What a tutor has earned, session by session.
//
// This page used to be two tables that disagreed about what they were for: one
// of monthly totals and one of payments, with no way to see which lesson a
// payment covered. It is one ledger now, a row per session that has run, and
// the payment state lives on the same row as the money.
//
// Confirming a session lives here rather than on the sessions page. The
// sessions page answers what happened; this one answers what is owed, and a
// tutor checking whether they have been paid is exactly the person who should
// be asked to confirm the ones still waiting.
// ============================================================

const FILTERS = [
  { value: "all", label: "All" },
  { value: "none", label: "Not requested" },
  { value: "requested", label: "Awaiting payment" },
  { value: "paid", label: "Paid" },
];

function StatusCell({ row }: { row: EarningRow }) {
  if (row.payoutStatus === "paid") {
    return (
      <div className="text-right">
        <p className="text-[13.5px] font-medium text-[#1099A1]">Paid</p>
        <p className="text-[12px] text-muted-foreground">
          {row.method ? methodLabel(row.method) : "-"}
          {row.reference ? ` · ${row.reference}` : ""}
        </p>
      </div>
    );
  }

  if (row.payoutStatus === "requested") {
    return (
      <div className="text-right">
        <p className="text-[13.5px] font-medium text-[#CAA25F]">Awaiting payment</p>
        <p className="text-[12px] text-muted-foreground">
          {row.requestedAt
            ? `Asked ${new Date(row.requestedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
            : ""}
        </p>
      </div>
    );
  }

  return <p className="text-right text-[13.5px] text-muted-foreground">Not requested</p>;
}

export function TutorEarnings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tutor-earnings", user?.id],
    queryFn: () => getTutorEarnings(user!.id),
    enabled: !!user?.id,
  });

  const totals = useMemo(() => {
    const sum = (test: (r: EarningRow) => boolean) =>
      rows.filter(test).reduce((n, r) => n + r.amountCents, 0);
    return {
      earned: sum(() => true),
      paid: sum((r) => r.payoutStatus === "paid"),
      awaiting: sum((r) => r.payoutStatus === "requested"),
      unclaimed: sum((r) => r.payoutStatus === "none"),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.payoutStatus !== filter) return false;
      if (!needle) return true;
      return (
        r.subject.toLowerCase().includes(needle) ||
        (r.studentName ?? "").toLowerCase().includes(needle) ||
        (r.reference ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, search]);

  const pending = rows.filter((r) => r.payoutStatus === "none");

  const request = async (ids: string[]) => {
    setBusy(ids.length === 1 ? ids[0] : "all");
    let done = 0;
    const problems: string[] = [];

    // One at a time, because each is checked separately and one refusal must
    // not cost the others.
    for (const id of ids) {
      const result = await requestSessionPayment(id);
      if (result.success) done += 1;
      else problems.push(result.error ?? "Could not request that session.");
    }

    setBusy(null);
    if (done > 0) {
      toast.success(done === 1 ? "Payment requested." : `${done} sessions requested.`);
      void queryClient.invalidateQueries({ queryKey: ["tutor-earnings", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["tutor-sessions", user?.id] });
    }
    // The server's refusals explain themselves, so the first is shown as it is.
    if (problems.length > 0) toast.error(problems[0]);
  };

  return (
    <PageWrapper>
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-[#1099A1] px-6 pt-6 text-white md:px-10 md:pt-10">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col justify-between gap-6 border-b border-white/20 pb-8 md:flex-row md:items-end">
            <div className="space-y-1">
              <h1 className="mb-2 text-[14px] font-medium uppercase tracking-wider text-white/80">
                Total earned
              </h1>
              <span className="text-4xl font-bold tracking-tight md:text-5xl">
                {usd(totals.earned)}
              </span>
              <p className="pt-1 text-[14px] text-white/70">
                {rows.length} {rows.length === 1 ? "session" : "sessions"} taught
              </p>
            </div>

            <div className="flex items-center gap-8 pb-2 md:gap-12">
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Paid
                </p>
                <p className="text-2xl font-bold">{usd(totals.paid)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Awaiting
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(totals.awaiting)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Not requested
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(totals.unclaimed)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-6 md:p-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 border-b border-border px-1 py-2 focus-within:border-[#1099A1]">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by subject, student or reference"
                className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <Dropdown
              value={filter}
              onChange={setFilter}
              options={FILTERS}
              className="w-[190px]"
            />

            {/* Requesting one at a time is the fiddly part of doing this per
                session, so a week of teaching can go in one go. */}
            {pending.length > 1 && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => request(pending.map((r) => r.sessionId))}
                className="h-10 rounded-md bg-[#1099A1] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy === "all" ? "Requesting..." : `Request all ${pending.length}`}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-[14px] text-muted-foreground">
              {rows.length === 0
                ? "Nothing yet. A session appears here once it has run."
                : "No sessions match that."}
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Session
                  </th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Length
                  </th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.sessionId} className="border-b border-border last:border-0">
                    <td className="py-4 pr-4 align-top">
                      <p className="text-[14px] text-foreground">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <p className="text-[14px] font-medium text-foreground">{r.subject}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {r.studentName ?? "Student"}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-right align-top text-[13.5px] tabular-nums text-muted-foreground">
                      {r.durationMinutes} min
                    </td>
                    <td
                      className={cn(
                        "py-4 pr-4 text-right align-top text-[14px] font-medium tabular-nums",
                        r.amountCents === 0 ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {r.amountCents === 0 ? "-" : usd(r.amountCents)}
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <StatusCell row={r} />
                    </td>
                    <td className="py-4 text-right align-top">
                      {r.payoutStatus === "none" && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => request([r.sessionId])}
                          className="h-9 rounded-md border border-[#1099A1] px-4 text-[13.5px] font-medium text-[#1099A1] transition-colors hover:bg-[#1099A1]/10 disabled:opacity-60"
                        >
                          {busy === r.sessionId ? "Requesting..." : "Request payment"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
