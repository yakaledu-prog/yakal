import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, CheckSquare, BookOpen, Bell, History, Library, MessagesSquareIcon } from "lucide-react";

export function StudentLayout() {
  const navItems = [
    { name: "Home", href: "/student", icon: <Home size={20} /> },
    { name: "Tasks", href: "/student/tasks", icon: <CheckSquare size={20} /> },
    { name: "Courses", href: "/student/courses", icon: <Library size={20} /> },
    { name: "Calendar", href: "/student/calendar", icon: <Calendar size={20} /> },
    { name: "Sessions", href: "/student/sessions", icon: <History size={20} /> },
    { name: "Messages", href: "/student/messages", icon: <MessagesSquareIcon size={20} /> },
    { name: "Resources", href: "/student/resources", icon: <BookOpen size={20} /> },
    { name: "Notifications", href: "/student/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/student" />;
}
