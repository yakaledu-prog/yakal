import { useMemo, useState } from "react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { DEMO_BILLING, DEMO_CHILDREN } from "../demoFixtures";
import { BillingHeader, ChildSidebar, Empty, Money, PackageActions, SlotMeter, Spinner } from "./shared";

// ============================================================
// Billing 1: children on the left, tabs across the body.
//
// The premise is that a parent arrives with one of three separate questions,
// and mixing them is what made the old page hard to read:
//
//   Plans     what am I on and how much of it is left
//   Payments  what have I been charged
//   Methods   which card pays for it
//
// Tabs keep each answer whole. The cost is that nothing is visible until you
// pick a tab, so the thing you most often want is one click away rather than
// on screen. Plans leads because it is the only tab with anything to act on.
//
// Reads fixed data, not the database. This is a design to look at, and it
// should look the same next month. See demoFixtures.
// ============================================================

const TABS = [
  { id: "plans", label: "Plans" },
  { id: "payments", label: "Payments" },
  { id: "methods", label: "Payment methods" },
] as const;

export function Billing1() {
  const [childId, setChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plans");

  const children = DEMO_CHILDREN;
  const data = DEMO_BILLING;
  const isLoading = false;

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

  const monthlyTotal = packages.reduce((n, p) => n + p.totalPaidCents, 0);

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
              { label: "Plans", value: packages.length },
              { label: "Paid to date", value: money(monthlyTotal) },
            ]}
          >
            <nav className="mt-6 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "whitespace-nowrap border-b-[3px] px-4 py-3 text-[14px] transition-colors",
                    tab === t.id
                      ? "border-white font-semibold text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </BillingHeader>

          <div className="p-6">
            {isLoading ? (
              <Spinner />
            ) : tab === "plans" ? (
              packages.length === 0 ? (
                <Empty
                  title="No plans yet"
                  body="A plan appears here once you book a course for one of your children."
                />
              ) : (
                <div className="space-y-3">
                  {packages.map((p) => (
                    <article
                      key={`${p.courseId}|${p.studentId}`}
                      className="rounded-xl border border-border bg-card p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-medium text-foreground">
                            {p.courseTitle}
                          </h3>
                          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            {p.studentName}
                            {p.tutorName && ` with ${p.tutorName}`}
                            {" - "}
                            {p.recurring ? "Monthly" : "One-off purchase"}
                          </p>
                        </div>
                        <p className="text-[13px] text-muted-foreground">
                          <Money cents={p.totalPaidCents} /> paid
                        </p>
                      </div>

                      <SlotMeter pkg={p} className="mt-4" />

                      <div className="mt-4 border-t border-border pt-3">
                        <PackageActions pkg={p} />
                      </div>
                    </article>
                  ))}
                </div>
              )
            ) : tab === "payments" ? (
              invoices.length === 0 ? (
                <Empty title="Nothing yet" body="Payments appear here once you have made one." />
              ) : (
                <ul className="divide-y divide-border">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-foreground">{i.description}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {i.studentName ?? "You"}
                          {" - "}
                          {new Date(i.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[12.5px] font-medium capitalize",
                          i.status === "paid" ? "text-primary" : "text-[#8a6a2a] dark:text-secondary"
                        )}
                      >
                        {i.status}
                      </span>
                      <span className="w-24 text-right text-[14px] text-foreground">
                        <Money cents={i.amountCents} />
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <Empty
                title="Cards are managed by Stripe"
                body="Opening the customer portal lets you add or remove a card without us ever holding the details."
              />
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
