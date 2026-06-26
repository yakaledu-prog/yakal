import { cn } from "@/utils/cn";
import { ReactNode } from "react";

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  icon?: ReactNode;
  status?: 'default' | 'primary' | 'success' | 'destructive' | 'warning';
}

interface ActivityTimelineProps {
  items: ActivityItem[];
  className?: string;
}

export function ActivityTimeline({ items, className }: ActivityTimelineProps) {
  return (
    <div className={cn("relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:ml-[8.5rem] md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent", className)}>
      {items.map((item) => {
        let statusColor = "bg-muted text-muted-foreground";
        switch(item.status) {
          case 'primary': statusColor = "bg-primary text-primary-foreground"; break;
          case 'success': statusColor = "bg-emerald-500 text-white"; break;
          case 'destructive': statusColor = "bg-destructive text-destructive-foreground"; break;
          case 'warning': statusColor = "bg-amber-500 text-white"; break;
        }

        return (
          <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Icon */}
            <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm", statusColor)}>
              {item.icon || <div className="w-2 h-2 rounded-full bg-current" />}
            </div>
            
            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border bg-card shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2">
                <div className="font-medium text-foreground">{item.title}</div>
                <time className="text-xs font-medium text-muted-foreground">{item.time}</time>
              </div>
              <div className="text-sm text-muted-foreground">{item.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
