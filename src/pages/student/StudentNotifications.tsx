import { NotificationsScreen } from "@/components/shared/NotificationsScreen";

export function StudentNotifications() {
  return (
    <NotificationsScreen
      subtitle="Updates from your tutors, counselor and the Yakal team."
      emptyHint="Session reminders, assignment updates and replies will show up here."
    />
  );
}
