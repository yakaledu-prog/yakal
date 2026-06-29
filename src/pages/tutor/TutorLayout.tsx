import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, CheckSquare, Bell, History, Library, MessagesSquareIcon } from "lucide-react";

export function TutorLayout() {
  const navItems = [
    { name: "Home", href: "/student", icon: <Home size={20} /> },
    { name: "Courses", href: "/tutor/courses", icon: <Library size={20} /> },
    { name: "My Learning", href: "/tutor/my-learning", icon: <CheckSquare size={20} /> },
    { name: "Calendar", href: "/tutor/calendar", icon: <Calendar size={20} /> },
    { name: "Sessions", href: "/tutor/sessions", icon: <History size={20} /> },
    { name: "Messages", href: "/tutor/messages", icon: <MessagesSquareIcon size={20} /> },
    { name: "Notifications", href: "/tutor/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/student" />;
}
