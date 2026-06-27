import { EmptyState } from "@/components/ui/EmptyState";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Hammer } from "lucide-react";
import { useLocation } from "react-router-dom";

export function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop() || 'Page';

  return (
    <PageWrapper>
      <div className="h-full flex items-center justify-center pt-20">
        <EmptyState
          icon={Hammer}
          title={`${pageName.charAt(0).toUpperCase() + pageName.slice(1)} Coming Soon`}
          description="This feature is currently under development."
        />
      </div>
    </PageWrapper>
  );
}
