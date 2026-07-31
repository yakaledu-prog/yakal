import { NotificationsScreen } from "@/components/shared/NotificationsScreen";

export function CounselorNotifications() {
  return (
    <NotificationsScreen
      subtitle="Application updates and messages from your students."
      emptyHint="Essay drafts, deadlines and student replies will show up here."
    />
  );
}
