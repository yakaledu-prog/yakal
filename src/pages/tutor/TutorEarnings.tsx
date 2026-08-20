import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Dropdown } from "@/components/ui/Dropdown";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { money as usd } from "@/services/billingService";
import {
  getConnectStatus,
  getEarnings,
  methodLabel,
  startConnectOnboarding,
  type EarningRow,
} from "@/services/payoutService";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// What a tutor has earned, session by session.
//
// This page used to be two tables that disagreed about what they were for: one
// of monthly totals and one of payments, with no way to see which lesson a
// payment covered. It is one ledger now, a row per session that has run, and
// the payment state lives on the same row as the money.
//
// Nothing here asks to be paid. A lesson that has run pays out on its own once
// its hold expires, so the tutor's job on this page is to read it, not to
// chase it. The button that used to live here let a tutor authorise their own
// payment, which is why it is gone.
// ============================================================

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Not paid yet" },
  { value: "settled", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

/** "23 Aug" from a timestamp. */
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function StatusCell({
  row,
  bankConnected,
  asOf,
}: {
  row: EarningRow;
  bankConnected: boolean;
  /** When the data was fetched. Reading a clock during render is not pure. */
  asOf: number;
}) {
  if (row.status === "settled") {
    return (
      <div className="text-right">
        <p className="text-[13.5px] font-medium text-primary">Paid</p>
        <p className="text-[12px] text-muted-foreground">
          {row.method ? methodLabel(row.method) : "-"}
          {row.reference ? ` · ${row.reference}` : ""}
        </p>
      </div>
    );
  }

  if (row.status === "cancelled" || row.status === "reversed") {
    return (
      <div className="text-right">
        <p className="text-[13.5px] font-medium text-muted-foreground">
          {row.status === "cancelled" ? "Cancelled" : "Reversed"}
        </p>
        <p className="text-[12px] text-muted-foreground">{row.note ?? ""}</p>
      </div>
    );
  }

  // Still owed. Which of the two reasons it has not moved is the thing the
  // tutor actually wants to know, and only one of them is theirs to fix.
  const clearing = !!row.releasableAt && new Date(row.releasableAt).getTime() > asOf;

  return (
    <div className="text-right">
      <p className="text-[13.5px] font-medium text-secondary">
        {clearing ? "Clearing" : bankConnected ? "Paying out" : "Awaiting your bank"}
      </p>
      <p className="text-[12px] text-muted-foreground">
        {clearing && row.releasableAt
          ? `Pays out ${shortDate(row.releasableAt)}`
          : bankConnected
            ? "On the next run"
            : "Connect a bank to receive it"}
      </p>
    </div>
  );
}

export function TutorEarnings() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [connecting, setConnecting] = useState(false);

  // dataUpdatedAt rather than a clock read during render: whether an earning
  // is still clearing is judged against the moment the data was fetched, which
  // is both pure and the honest answer for what is on screen.
  const { data: rows = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["tutor-earnings", user?.id],
    queryFn: () => getEarnings(user!.id),
    enabled: !!user?.id,
  });

  // Without a connected bank there is nothing to transfer into, so an earning
  // sits pending however long its hold was. That is worth saying before the
  // tutor waits and wonders why nothing arrived.
  const { data: connect } = useQuery({
    queryKey: ["connect-status", user?.id],
    queryFn: () => getConnectStatus(user!.id),
    enabled: !!user?.id,
  });

  const totals = useMemo(() => {
    const sum = (test: (r: EarningRow) => boolean) =>
      rows.filter(test).reduce((n, r) => n + r.amountCents, 0);
    const held = (r: EarningRow) =>
      !!r.releasableAt && new Date(r.releasableAt).getTime() > dataUpdatedAt;
    return {
      earned: sum((r) => r.status !== "cancelled" && r.status !== "reversed"),
      paid: sum((r) => r.status === "settled"),
      clearing: sum((r) => r.status === "pending" && held(r)),
      due: sum((r) => r.status === "pending" && !held(r)),
    };
  }, [rows, dataUpdatedAt]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      return (
        r.subject.toLowerCase().includes(needle) ||
        (r.studentName ?? "").toLowerCase().includes(needle) ||
        (r.reference ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, search]);


  return (
    <PageWrapper>
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-primary px-6 pt-6 text-white md:px-10 md:pt-10">
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
                  Clearing
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(totals.clearing)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Due
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(totals.due)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-6 md:p-10">
          {connect && !connect.payoutsEnabled && (
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-l-2 border-secondary bg-muted/30 px-5 py-4">
              <p className="text-[14px] text-foreground">
                Connect your bank and finished sessions pay out to you on their own. Until then
                what you have earned waits here and an admin pays it by hand.
              </p>
              <button
                type="button"
                disabled={connecting}
                onClick={async () => {
                  setConnecting(true);
                  const result = await startConnectOnboarding();
                  setConnecting(false);
                  if (result.error) toast.error(result.error);
                }}
                className="h-10 shrink-0 rounded-md bg-primary px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {connecting ? "Opening..." : connect.accountId ? "Finish connecting" : "Connect bank"}
              </button>
            </div>
          )}

          <div className="mb-12 flex flex-wrap items-center gap-6 md:gap-8">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 border-b border-border px-1 py-2 focus-within:border-primary">
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
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
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
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
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
                      <div className="flex items-center gap-3">
                        <img
                          src={r.studentAvatarUrl || dicebearUrl(r.studentName ?? "Yakal")}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">
                            {r.subject}
                          </p>
                          <p className="truncate text-[12.5px] text-muted-foreground">
                            {r.studentName ?? "Student"}
                          </p>
                        </div>
                      </div>
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
                    <td className="py-4 text-right align-middle">
                      <StatusCell row={r} bankConnected={!!connect?.payoutsEnabled} asOf={dataUpdatedAt} />
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
