import { cn } from "@/utils/cn";
import { WeekDay } from "@/services/tutorService";

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** A 7-day strip showing each day's sessions (time + subject), last 7 days. */
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const total = days.reduce((n, d) => n + d.count, 0);
  return (
    <div className="week-strip rounded-xl border bg-card dark:bg-[#182329] shadow-sm p-5">
      <div className="week-strip__header flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Sessions this week</h3>
        <span className="text-[13px] text-muted-foreground">{total} total</span>
      </div>
      <div className="week-strip__grid grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div
            key={d.date}
            className={cn(
              "week-strip__day flex flex-col rounded-lg border overflow-hidden",
              d.isToday ? "border-primary" : "border-[#e9edef] dark:border-[#2a3942]"
            )}
          >
            <div className={cn(
              "week-strip__dayhead text-center py-2 border-b",
              d.isToday ? "bg-primary/5 border-primary/30" : "border-[#e9edef] dark:border-[#2a3942]"
            )}>
              <div className="text-[11px] font-medium text-muted-foreground">{d.label}</div>
              <div className={cn("text-[14px] font-bold", d.isToday ? "text-primary" : "text-foreground")}>{d.dayNum}</div>
            </div>
            <div className="week-strip__daybody flex flex-col gap-1 p-1.5 min-h-[76px]">
              {d.items.length === 0 ? (
                <span className="m-auto text-[13px] text-muted-foreground/50">—</span>
              ) : (
                d.items.map((it) => (
                  <div
                    key={it.id}
                    title={`${formatTime(it.time)} · ${it.subject} · ${it.student}`}
                    className={cn(
                      "week-strip__chip rounded-md px-1.5 py-1 text-[10.5px] leading-tight",
                      it.status === "completed"
                        ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : it.status === "upcoming"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground line-through"
                    )}
                  >
                    <div className="font-semibold">{formatTime(it.time)}</div>
                    <div className="truncate opacity-90">{it.subject}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
