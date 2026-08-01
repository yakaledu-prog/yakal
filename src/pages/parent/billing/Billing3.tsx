import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
import { getLinkedChildren } from "@/services/parentService";
import { getBilling, type CoursePackage } from "@/services/packageService";
import { ChildSidebar, Empty, Money, PackageActions, SlotMeter, Spinner } from "./shared";

// ============================================================
// Billing 3: a table of plans, with a panel for the one you pick.
//
// The premise is that managing a plan and comparing plans are different jobs.
// The table answers "where is my money going and what is running low" in one
// glance across every child. Acting on one opens a panel, so the comparison
// stays on screen behind it.
//
// This is the one that keeps working as the numbers grow: ten plans across
// four children is a readable table and an unreadable stack of cards. The cost
// is that a table is colder, and with two plans it is more structure than the
// content deserves.
// ============================================================

export function Billing3() {
  const { user } = useAuth();
  const [childId, setChildId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoursePackage | null>(null);

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

  const countFor = (id: string | null) =>
    (data?.packages ?? []).filter((p) => !id || p.studentId === id).length;

  const invoicesFor = (p: CoursePackage) =>
    (data?.invoices ?? []).filter((i) => i.courseId === p.courseId && i.studentId === p.studentId);

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
          <div className="p-6 md:p-8">
            <h1 className="text-[22px] font-medium text-foreground">Billing</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Every plan you are paying for, and how much of each is left.
            </p>

            {isLoading ? (
              <Spinner />
            ) : packages.length === 0 ? (
              <Empty
                title="No plans yet"
                body="A plan appears here once you book a course for one of your children."
              />
            ) : (
              <div className="mt-6 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Child</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Sessions left</th>
                      <th className="px-4 py-3 text-right font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {packages.map((p) => (
                      <tr
                        key={`${p.courseId}|${p.studentId}`}
                        onClick={() => setSelected(p)}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-3">
                          <p className="text-[14px] font-medium text-foreground">{p.courseTitle}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {p.tutorName ?? "Tutor to be assigned"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <img
                              src={p.studentAvatarUrl || dicebearUrl(p.studentName)}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover"
                            />
                            <span className="text-[13.5px] text-foreground">{p.studentName}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-[13px] font-medium",
                              p.recurring ? "text-[#1099A1]" : "text-muted-foreground"
                            )}
                          >
                            {p.recurring ? "Monthly" : "One-off"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {/* The number that decides whether anything needs doing. */}
                          <span
                            className={cn(
                              "text-[15px] font-medium",
                              p.slotsUnscheduled === 0
                                ? "text-[#8a6a2a] dark:text-[#CAA25F]"
                                : "text-foreground"
                            )}
                          >
                            {p.slotsUnscheduled}
                          </span>
                          <span className="text-[13px] text-muted-foreground">
                            {" / "}
                            {p.slotsPurchased}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[13.5px] text-foreground">
                          <Money cents={p.totalPaidCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Managing one plan, with the table still behind it. */}
        {selected && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30"
            onClick={() => setSelected(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-medium text-foreground">
                    {selected.courseTitle}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {selected.studentName}
                    {selected.tutorName && ` with ${selected.tutorName}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
                >
                  <X size={18} />
                </button>
              </div>

              <SlotMeter pkg={selected} className="mt-6" />

              <div className="mt-6">
                <PackageActions pkg={selected} />
              </div>

              <div className="mt-8 border-t border-border pt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Payments for this plan
                </p>
                <ul className="divide-y divide-border">
                  {invoicesFor(selected).map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                        {new Date(i.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[13px] text-foreground">
                        <Money cents={i.amountCents} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
