import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, Download, UserMinus } from "lucide-react";
import { format } from "date-fns";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getSubscribers, type Subscriber } from "@/services/newsletterService";
import { cn } from "@/utils/cn";
import { AdminHeader } from "../AdminHeader";

/**
 * The newsletter list.
 *
 * Numbers rather than faces: a subscriber is an email address, not an account,
 * so there is no name and no avatar. A stack of generated ones would imply a
 * roster of people who never signed up for anything but this.
 *
 * Unsubscribed rows stay on the page, greyed. Hiding them makes a falling
 * count unexplainable from the screen that reports it.
 */
export function AdminSubscribers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [toRemove, setToRemove] = useState<Subscriber | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: () => getSubscribers(),
  });

  const all = useMemo(() => data?.subscribers ?? [], [data]);

  const subscribed = all.filter((s) => s.status === "subscribed");

  // Read once per mount rather than during render: the compiler rules count a
  // clock call in the render body as impure, and a count that shifts because
  // something else on the page re-rendered is worse than one that is a few
  // minutes stale.
  const [mountedAt] = useState(() => Date.now());
  const newThisWeek = useMemo(() => {
    const cutoff = mountedAt - 7 * 86_400_000;
    return subscribed.filter((s) => new Date(s.created_at).getTime() >= cutoff).length;
  }, [subscribed, mountedAt]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? all.filter((s) => s.email.toLowerCase().includes(term)) : all;
  }, [all, q]);

  const stats = [
    { label: "Subscribed", value: subscribed.length },
    { label: "Unsubscribed", value: all.length - subscribed.length },
    { label: "New this week", value: newThisWeek },
  ];

  /**
   * Built in the browser from rows already loaded, so there is no export
   * endpoint to secure. Only the subscribed are written: the point of the file
   * is to move the list somewhere else, and carrying opted-out addresses into
   * a new provider is how they get mailed again.
   */
  function exportCsv() {
    if (!subscribed.length) return toast.error("Nobody to export.");
    const rows = [
      ["email", "joined", "source"],
      ...subscribed.map((s) => [s.email, s.created_at, s.source]),
    ];
    // Quoted, because an address is user input and a stray comma would shift
    // every column after it.
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `yakal-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmRemove() {
    if (!toRemove) return;
    const res = await getSubscribers(toRemove.id);
    if (res.error) return toast.error(res.error);
    toast.success(`${toRemove.email} unsubscribed.`);
    setToRemove(null);
    qc.invalidateQueries({ queryKey: ["admin-subscribers"] });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background dark:bg-[#111b21]">
        <AdminHeader title="Subscribers" subtitle="The newsletter list" stats={stats} />

        <div className="mx-auto w-full space-y-5 p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border px-3 py-2.5 transition-colors focus-within:border-primary">
              <Search size={17} className="shrink-0 text-muted-foreground group-focus-within:text-primary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </div>
            <button
              onClick={exportCsv}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13px] font-normal transition-colors hover:bg-muted/60"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : shown.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">
              {q ? "Nobody matches that." : "Nobody has subscribed yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-4 font-medium">Email</th>
                    <th className="py-2.5 pr-4 font-medium">Joined</th>
                    <th className="py-2.5 pr-4 font-medium">Source</th>
                    <th className="py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => {
                    const gone = s.status === "unsubscribed";
                    return (
                      <tr
                        key={s.id}
                        className={cn("group border-b border-border/60", gone && "text-muted-foreground")}
                      >
                        <td className="py-3 pr-4 text-[14px]">
                          <span className={cn(gone && "line-through")}>{s.email}</span>
                          {gone && <span className="ml-2 text-[12px]">unsubscribed</span>}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-muted-foreground">
                          {format(new Date(s.created_at), "d MMM yyyy")}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-muted-foreground">{s.source}</td>
                        <td className="py-3 text-right">
                          {!gone && (
                            <button
                              onClick={() => setToRemove(s)}
                              aria-label={`Unsubscribe ${s.email}`}
                              title="Unsubscribe"
                              className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                            >
                              <UserMinus size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={confirmRemove}
        title="Unsubscribe"
        message={`Take ${toRemove?.email} off the newsletter? They stay on the list marked unsubscribed, so signing up again is theirs to do.`}
        confirmText="Unsubscribe"
        isDestructive
      />
    </PageWrapper>
  );
}
