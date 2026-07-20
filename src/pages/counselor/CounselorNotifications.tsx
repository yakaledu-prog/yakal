import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function CounselorNotifications() {
  const { user } = useAuth();
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, message, is_read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data as Notif[]) || [];
    },
    enabled: !!user?.id,
  });

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <div className="bg-[#1099A1] text-white p-6 md:p-10">
          <div className="max-w-[900px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          </div>
        </div>
        <div className="max-w-[900px] mx-auto p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 text-[#8696a0]">
              <Bell size={40} className="mx-auto mb-3 opacity-60" />
              <p className="text-[14px]">You're all caught up.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notes.map((n) => (
                <div key={n.id} className={cn("p-4 rounded-xl border bg-white dark:bg-[#111b21] border-[#e9edef] dark:border-[#2a3942]", !n.is_read && "border-l-4 border-l-[#1099A1]")}>
                  <p className="text-[15px] font-semibold text-[#111] dark:text-white">{n.title}</p>
                  <p className="text-[13px] text-[#667781] dark:text-[#8696a0] mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
