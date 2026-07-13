import { cn } from "@/utils/cn";

/** Drop this around any page that needs standard padding + scroll */
export function PageWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>
      {children}
    </div>
  );
}
