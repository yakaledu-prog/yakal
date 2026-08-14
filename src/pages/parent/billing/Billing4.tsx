import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { type CoursePackage } from "@/services/packageService";
import { money } from "@/services/billingService";
import { DEMO_BILLING, DEMO_CHILDREN } from "../demoFixtures";
import {
  AddSlotsModal,
  BillingHeader,
  ChildSidebar,
  Empty,
  Money,
  PackageActions,
  SessionWeekGrid,
  SlotMeter,
  Spinner,
} from "./shared";

// ============================================================
// Billing 4: Billing 1, with the sessions behind each plan.
//
// Same tabs, because separating the three questions still holds. What changes
// is that a plan opens: the counts on the card are a summary of a list, and
// the list was nowhere to be found. Expanding shows the actual sessions and
// what happened to each.
//
// Add slots opens a modal rather than sending the parent back to the course
// page. They are looking at the plan they want more of, and a redirect loses
// their place.
//
// Reads fixed data, not the database. See demoFixtures.
// ============================================================

const TABS = [
  { id: "plans", label: "Plans" },
  { id: "payments", label: "Payments" },
  { id: "methods", label: "Payment methods" },
] as const;

export function Billing4() {
  const [childId, setChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plans");
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [adding, setAdding] = useState<CoursePackage | null>(null);

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

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                        <PackageActions pkg={p} onAddSlots={() => setAdding(p)} />
                        <button
                          onClick={() =>
                            setOpenPlan((k) =>
                              k === `${p.courseId}|${p.studentId}`
                                ? null
                                : `${p.courseId}|${p.studentId}`
                            )
                          }
                          className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                        >
                          {openPlan === `${p.courseId}|${p.studentId}` ? "Hide" : "Show"} sessions
                          <ChevronDown
                            size={14}
                            className={cn(
                              "transition-transform",
                              openPlan === `${p.courseId}|${p.studentId}` && "rotate-180"
                            )}
                          />
                        </button>
                      </div>

                      {openPlan === `${p.courseId}|${p.studentId}` && (
                        <div className="mt-3 border-t border-border pt-2">
                          <SessionWeekGrid pkg={p} />
                        </div>
                      )}
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
      {adding && <AddSlotsModal pkg={adding} onClose={() => setAdding(null)} />}
    </PageWrapper>
  );
}
