import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, CheckSquare, Bell, History, MessagesSquareIcon, Map, List, ClipboardList } from "lucide-react";

export function StudentLayout() {
  const navItems = [
    { name: "Home", href: "/student", icon: <Home size={20} /> },
    { name: "My Learning", href: "/student/my-learning", icon: <CheckSquare size={20} /> },
    { name: "Calendar", href: "/student/calendar", icon: <Calendar size={20} /> },
    { name: "Sessions", href: "/student/sessions", icon: <History size={20} /> },
    { name: "Roadmap", href: "/student/roadmap", icon: <Map size={20} /> },
    { name: "College List", href: "/student/college-list", icon: <List size={20} /> },
    { name: "My App", href: "/student/my-app", icon: <ClipboardList size={20} /> },
    { name: "Messages", href: "/student/messages", icon: <MessagesSquareIcon size={20} /> },
    { name: "Notifications", href: "/student/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/student" />;
}
