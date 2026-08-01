import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CreditCard } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { getLinkedChildren } from "@/services/parentService";
import { getBilling } from "@/services/packageService";
import { getPaymentMethods, money } from "@/services/billingService";
import {
  BillingHeader,
  ChildSidebar,
  CoverageHeatmap,
  Empty,
  Money,
  PackageActions,
  SlotMeter,
  Spinner,
} from "./shared";

// ============================================================
// Billing 5: Billing 2, with every session drawn as a square.
//
// Same single surface, because tabs cost a click to find nothing. What changes
// is the meter: a progress bar says how far along a plan is, a grid of squares
// says the same thing and also shows the shape of it. A solid run is a course
// being attended; a gap is one that stalled.
//
// Whether that earns its place is the open question. It reads well at twelve
// sessions and says very little at three, which is what most plans are today.
// ============================================================

export function Billing5() {
  const { user } = useAuth();
  const [childId, setChildId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing", user?.id],
    queryFn: () => getBilling(user!.id),
    enabled: !!user?.id,
  });

  const packages = useMemo(
    () => (data?.packages ?? []).filter((p) => !childId || p.studentId === childId),
    [data, childId]
  );
  const invoices = useMemo(
    () => (data?.invoices ?? []).filter((i) => !childId || i.studentId === childId),
    [data, childId]
  );

  const countFor = (id: string | null) =>
    (data?.packages ?? []).filter((p) => !id || p.studentId === id).length;

  const { data: cards = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: getPaymentMethods,
  });

  const paid = packages.reduce((n, p) => n + p.totalPaidCents, 0);
  const upcoming = packages.reduce((n, p) => n + p.slotsUpcoming, 0);

  return (
    <PageWrapper className="!p-0">
      <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background md:flex-row md:overflow-hidden">
        <ChildSidebar
          children={children}
          activeId={childId}
          onSelect={setChildId}
          countFor={countFor}
        />

        <section className="min-w-0 flex-1 md:h-full md:overflow-y-auto">
          <BillingHeader
            subtitle={
              childId
                ? (children.find((c) => c.id === childId)?.full_name ?? "")
                : "Everything across your children"
            }
            stats={[
              { label: "Still to come", value: upcoming },
              { label: "Paid to date", value: money(paid) },
            ]}
          >
            {/* The card sits with the numbers rather than in a panel of its
                own: it is a fact about the account, not a section. */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/20 pb-5 pt-4">
              <CreditCard size={16} className="text-white/70" />
              <span className="text-[13.5px] text-white/90">
                {cards.length > 0
                  ? `${(cards[0].brand ?? "Card").toUpperCase()} ending ${cards[0].last4}`
                  : "No card on file"}
              </span>
              <button className="text-[13px] font-medium text-white underline underline-offset-2">
                Manage
              </button>
            </div>
          </BillingHeader>

          <div className="mx-auto max-w-[860px] p-6 md:p-8">
            {isLoading ? (
              <Spinner />
            ) : packages.length === 0 ? (
              <Empty
                title="No plans yet"
                body="A plan appears here once you book a course for one of your children."
              />
            ) : (
              <div className="mt-6 space-y-4">
                {packages.map((p) => (
                  <article
                    key={`${p.courseId}|${p.studentId}`}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="flex gap-4 p-5">
                      {p.thumbnailUrl && (
                        <img
                          src={p.thumbnailUrl}
                          alt=""
                          className="hidden h-20 w-28 shrink-0 rounded-lg object-cover sm:block"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[16px] font-medium text-foreground">
                              {p.courseTitle}
                            </h3>
                            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                              {p.studentName}
                              {p.tutorName && ` with ${p.tutorName}`}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "text-[12.5px] font-medium",
                              p.recurring ? "text-[#1099A1]" : "text-muted-foreground"
                            )}
                          >
                            {p.recurring ? "Monthly" : "One-off"}
                          </p>
                        </div>

                        <SlotMeter pkg={p} className="mt-3" />

                        <div className="mt-3">
                          <CoverageHeatmap pkg={p} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3">
                      <PackageActions pkg={p} size="sm" />
                      <p className="text-[12.5px] text-muted-foreground">
                        <Money cents={p.totalPaidCents} /> paid
                        {p.pricePerSlotCents != null && (
                          <>
                            {" - "}
                            <Money cents={p.pricePerSlotCents} /> per session
                          </>
                        )}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Folded away: needed occasionally, never first. */}
            <div className="mt-8 border-t border-border pt-4">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-[14px] font-medium text-foreground">
                  Payment history
                  <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                    {invoices.length}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-muted-foreground transition-transform",
                    historyOpen && "rotate-180"
                  )}
                />
              </button>

              {historyOpen && (
                <ul className="mt-3 divide-y divide-border">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] text-foreground">{i.description}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {new Date(i.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="text-[13.5px] text-foreground">
                        <Money cents={i.amountCents} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
