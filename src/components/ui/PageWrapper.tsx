import { cn } from "@/utils/cn";

/** Drop this around any page that needs standard padding + scroll */
export function PageWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("!m-0 !p-0 overflow-y-auto !w-full h-screen overflow-x-hidden hide-scrollbar", className)}>
      {children}
    </div>
  );
}
