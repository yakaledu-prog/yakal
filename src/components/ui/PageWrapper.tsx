/** Drop this around any page that needs standard padding + scroll */
export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {children}
    </div>
  );
}
