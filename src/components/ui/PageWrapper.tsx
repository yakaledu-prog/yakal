/** Drop this around any page that needs standard padding + scroll */
export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20">
      {children}
    </div>
  );
}
