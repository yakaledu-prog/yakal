import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, Bell, Users, Library, ClipboardList, History, MessagesSquare, Wallet } from "lucide-react";

export function TutorLayout() {
  const navItems = [
    { name: "Home", href: "/tutor", icon: <Home size={20} /> },
    { name: "Students", href: "/tutor/students", icon: <Users size={20} /> },
    { name: "Sessions", href: "/tutor/sessions", icon: <History size={20} /> },
    { name: "Calendar", href: "/tutor/calendar", icon: <Calendar size={20} /> },
    { name: "Courses", href: "/tutor/courses", icon: <Library size={20} /> },
    { name: "Assignments", href: "/tutor/assignments", icon: <ClipboardList size={20} /> },
    { name: "Earnings", href: "/tutor/earnings", icon: <Wallet size={20} /> },
    { name: "Messages", href: "/tutor/messages", icon: <MessagesSquare size={20} /> },
    { name: "Notifications", href: "/tutor/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/tutor" />;
}
