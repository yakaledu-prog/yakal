import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Landmark,
  Loader2,
  Search,
  Smartphone,
  Zap,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Dropdown } from "@/components/ui/Dropdown";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { money as usd } from "@/services/billingService";
import {
  getConnectStatus,
  getEarnings,
  methodLabel,
  openPayoutsDashboard,
  refreshConnectStatus,
  startConnectOnboarding,
  type EarningRow,
} from "@/services/payoutService";
import { dicebearUrl } from "@/utils/avatar";
import { useSeen } from "@/hooks/useSeen";
import { SortHeader, sortRows, type Sort } from "@/components/ui/SortHeader";
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

type SortCol = "date" | "subject" | "length" | "amount" | "method" | "status";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Not paid yet" },
  { value: "settled", label: "Paid" },
  { value: "cancelled", label: "Not payable" },
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
          {row.settledAt ? shortDate(row.settledAt) : ""}
        </p>
      </div>
    );
  }

  // "Not payable" rather than "Cancelled": nothing the tutor did was cancelled,
  // the money simply never became theirs, usually because the lesson was
  // refunded. The reason underneath is the part that helps.
  if (row.status === "cancelled" || row.status === "reversed") {
    return (
      <div className="text-right">
        <p className="text-[13.5px] font-medium text-destructive">
          {row.status === "cancelled" ? "Not payable" : "Reversed"}
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
        {clearing ? "Clearing" : bankConnected ? "Due" : "Awaiting your bank"}
      </p>
      <p className="text-[12px] text-muted-foreground">
        {clearing && row.releasableAt
          ? `Clears ${shortDate(row.releasableAt)}`
          : bankConnected
            ? "On the next run"
            : "Connect a bank to receive it"}
      </p>
    </div>
  );
}

/**
 * Which rail paid it, as its own column.
 *
 * It used to sit under the status, where it competed with the one thing that
 * line is for. A tutor reconciling against their bank statement is looking for
 * the reference, and it should be findable without reading a status first.
 *
 * Line icons from the set the rest of the app uses, deliberately, rather than
 * each provider's brand mark: a row of mismatched logos next to lucide icons
 * everywhere else looks like scraped assets, which is what it would be.
 */
function MethodCell({ row }: { row: EarningRow }) {
  if (row.status !== "settled" || !row.method) {
    return <span className="text-[13px] text-muted-foreground">-</span>;
  }

  const Icon =
    row.method === "stripe_connect"
      ? Zap
      : row.method === "check"
        ? FileText
        : row.method === "wire" || row.method === "ach"
          ? Landmark
          : Smartphone;

  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] text-foreground">{methodLabel(row.method)}</p>
        {row.reference && (
          <p className="truncate text-[12px] text-muted-foreground">{row.reference}</p>
        )}
      </div>
    </div>
  );
}

/**
 * What somebody who is paid by Yakal has earned.
 *
 * One screen for tutors and counsellors, because the earnings ledger is one
 * table and they are reading the same rows out of it. The counsellor had a
 * second page built to resemble this one, with its own banner, a chart of
 * empty months and a payout list that repeated what the Method and Status
 * columns already say. Two money screens that drift is the wrong kind of two.
 *
 * The only differences are wording: a tutor counts sessions taught, a
 * counsellor counts months earned, and neither sentence is true of the other.
 */
export function EarningsScreen({
  countLabel,
  searchPlaceholder,
  emptyText,
  /** Counselling earns per plan month, which has no length. */
  showLength = true,
}: {
  countLabel: (n: number) => string;
  searchPlaceholder: string;
  emptyText: string;
  showLength?: boolean;
}) {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<Sort<SortCol>>({ col: "date", dir: "desc" });
  const { isNew } = useSeen("earnings");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

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

  // Ask Stripe what is actually true, rather than trusting the stored flag.
  //
  // getConnectStatus only reads what the account.updated webhook last wrote,
  // and that webhook needs the Stripe CLI forwarding locally and can be late or
  // missed in production. A tutor who had finished onboarding was left on a
  // page still telling them to finish onboarding, with nothing to press.
  //
  // Two triggers, because either one alone leaves somebody stuck:
  //
  //   returning from Stripe, which is the moment it changes
  //   an account that exists but is not enabled, which is that same tutor
  //   coming back tomorrow, after the redirect is long gone
  //
  // The ref keeps it to once per visit. The second trigger cannot depend on
  // payoutsEnabled without re-running every time the answer is still no.
  const asked = useRef(false);
  useEffect(() => {
    if (!user?.id || asked.current) return;
    const returning = params.get("connect") === "done";
    const looksStuck = !!connect?.accountId && !connect.payoutsEnabled;
    if (!returning && !looksStuck) return;

    asked.current = true;
    (async () => {
      const res = await refreshConnectStatus();
      await qc.invalidateQueries({ queryKey: ["connect-status", user.id] });
      // Only on the way back from Stripe. Saying "your bank is connected" to
      // somebody who merely opened their earnings page is news to nobody.
      if (returning) {
        if (res.payoutsEnabled) {
          toast.success("Your bank is connected. Payments will come here from now on.");
        } else if (res.needs?.length) {
          toast("Stripe still needs a few details before payments can reach you.");
        }
        params.delete("connect");
        setParams(params, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, user?.id, connect?.accountId, connect?.payoutsEnabled]);

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
    const matched = rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      return (
        r.subject.toLowerCase().includes(needle) ||
        (r.studentName ?? "").toLowerCase().includes(needle) ||
        (r.reference ?? "").toLowerCase().includes(needle)
      );
    });

    // Sorted by what the column means rather than by what it displays. Status
    // sorts by how far along the money is, not alphabetically, so one click
    // groups everything still owed together.
    const rank: Record<string, number> = { pending: 0, settled: 1, cancelled: 2, reversed: 3 };
    const key = (r: EarningRow): string | number => {
      switch (sort.col) {
        case "subject": return r.subject.toLowerCase();
        case "length": return r.durationMinutes ?? 0;
        case "amount": return r.amountCents;
        case "status": return rank[r.status] ?? 9;
        // Unpaid rows have no method, and sorting them into the middle of the
        // alphabet is noise. They go last either way.
        case "method": return r.method ? methodLabel(r.method).toLowerCase() : "zzz";
        default: return r.date;
      }
    };

    return sortRows(matched, sort, key);
  }, [rows, filter, search, sort]);


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
              <p className="pt-1 text-[14px] text-white/70">{countLabel(rows.length)}</p>
            </div>

            <div className="flex items-center gap-8 pb-2 md:gap-12">
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Paid
                </p>
                <p className="text-2xl font-bold">{usd(totals.paid)}</p>
              </div>
              {/* Clearing and Due are the same money at two stages, and the
                  words alone do not say which. The hint under each is what
                  stops a tutor wondering why a figure is not in their bank. */}
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Clearing
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(totals.clearing)}</p>
                <p className="pt-0.5 text-[11px] text-white/60">earned, on hold</p>
              </div>
              <div className="text-left md:text-right">
                <p className="mb-0.5 text-[12px] font-medium uppercase tracking-wider text-white/70">
                  Due
                </p>
                <p className="text-2xl font-bold opacity-80">{usd(totals.due)}</p>
                <p className="pt-0.5 text-[11px] text-white/60">next payout</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-6 md:p-10">
          {connect && !connect.payoutsEnabled && (
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-l-2 border-secondary bg-muted/30 px-5 py-4">
              <p className="text-[14px] text-foreground">
                Connect your bank and what you earn pays out to you on its own. Until then it
                waits here and an admin pays it by hand.
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

          {connect?.payoutsEnabled && (
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4 bg-muted/30 px-5 py-4 rounded">
              <p className="text-[14px] text-foreground">
                Payouts reach your bank weekly. Your Stripe dashboard has the history, your
                bank details and your tax forms, and can pay you out early.
              </p>
              <button
                type="button"
                disabled={openingDashboard}
                onClick={async () => {
                  setOpeningDashboard(true);
                  const result = await openPayoutsDashboard();
                  setOpeningDashboard(false);
                  if (result.error) toast.error(result.error);
                }}
                className="h-10 shrink-0 rounded-md border border-foreground px-5 text-[14px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {openingDashboard ? "Opening..." : "Open Stripe dashboard"}
              </button>
            </div>
          )}

          <div className="mb-12 flex flex-wrap items-center gap-6 md:gap-8">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 border-b border-border px-1 py-2 focus-within:border-primary">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
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
              {rows.length === 0 ? emptyText : "Nothing matches that."}
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <SortHeader label="Date" col="date" sort={sort} onSort={setSort} className="pr-4" />
                  <SortHeader label="Session" col="subject" sort={sort} onSort={setSort} className="pr-4" />
                  {showLength && (
                    <SortHeader label="Length" col="length" sort={sort} onSort={setSort} align="right" className="pr-4" />
                  )}
                  <SortHeader label="Amount" col="amount" sort={sort} onSort={setSort} align="right" className="pr-8" />
                  <SortHeader label="Method" col="method" sort={sort} onSort={setSort} className="pl-4 pr-4" />
                  <SortHeader label="Status" col="status" sort={sort} onSort={setSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  // Bold for one visit, the way an inbox does it. The row is
                  // new relative to when this page was last opened, not to
                  // whether anybody clicked it.
                  const fresh = isNew(r.createdAt);
                  return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-4 pr-4 align-top">
                      <p className={cn("text-[14px] text-foreground", fresh && "font-semibold")}>
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
                          <p
                            className={cn(
                              "truncate text-[14px] text-foreground",
                              fresh ? "font-bold" : "font-medium"
                            )}
                          >
                            {r.subject}
                          </p>
                          <p className="truncate text-[12.5px] text-muted-foreground">
                            {r.studentName ?? "Student"}
                          </p>
                        </div>
                      </div>
                    </td>
                    {showLength && (
                      <td className="py-4 pr-4 text-right align-top text-[13.5px] tabular-nums text-muted-foreground">
                        {r.durationMinutes} min
                      </td>
                    )}
                    <td
                      className={cn(
                        "py-4 pr-8 text-right align-top text-[14px] font-medium tabular-nums",
                        r.amountCents === 0 ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {r.amountCents === 0 ? "-" : usd(r.amountCents)}
                    </td>
                    <td className="py-4 pl-4 pr-4 align-middle">
                      <MethodCell row={r} />
                    </td>
                    <td className="py-4 text-right align-middle">
                      <StatusCell row={r} bankConnected={!!connect?.payoutsEnabled} asOf={dataUpdatedAt} />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
