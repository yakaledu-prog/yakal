import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, Bell, Users, Library, History, MessagesSquare, Wallet , Search } from "lucide-react";

export function TutorLayout() {
  const navItems = [
    { name: "Home", href: "/tutor", icon: <Home size={20} /> },
    { name: "Students", href: "/tutor/students", icon: <Users size={20} /> },
    { name: "Sessions", href: "/tutor/sessions", icon: <History size={20} /> },
    { name: "Calendar", href: "/tutor/calendar", icon: <Calendar size={20} /> },
    { name: "My Courses", href: "/tutor/courses", icon: <Library size={20} /> },
    { name: "Find Courses", href: "/tutor/find-courses", icon: <Search size={20} /> },
    { name: "Notifications", href: "/tutor/notifications", icon: <Bell size={20} /> },
    { name: "Messages", href: "/tutor/messages", icon: <MessagesSquare size={20} /> },
    { name: "Earnings", href: "/tutor/earnings", icon: <Wallet size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/tutor" />;
}
