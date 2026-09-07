import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, Bell, Users, Library, History, MessagesSquare, Wallet , Search } from "lucide-react";

export function TutorLayout() {
  // Five at most in the bottom bar on a phone, and they are the ones this role
  // opens constantly rather than the first five the sidebar lists. Everything
  // else stays in the drawer behind the menu button.
  //
  // Notifications is never here: it is a bell in the topbar with its own
  // unread count, and a second entry point would compete with it.
  const navItems = [
    { name: "Teaching Hub", href: "/tutor", icon: <Home size={20} />, mobile: true },
    { name: "Students", href: "/tutor/students", icon: <Users size={20} />, mobile: true },
    { name: "Lessons", href: "/tutor/sessions", icon: <History size={20} />, mobile: true },
    { name: "Calendar", href: "/tutor/calendar", icon: <Calendar size={20} />, mobile: true },
    { name: "My Courses", href: "/tutor/courses", icon: <Library size={20} /> },
    { name: "Find Courses", href: "/tutor/find-courses", icon: <Search size={20} /> },
    { name: "Notifications", href: "/tutor/notifications", icon: <Bell size={20} /> },
    { name: "Messages", href: "/tutor/messages", icon: <MessagesSquare size={20} />, mobile: true },
    { name: "Earnings", href: "/tutor/earnings", icon: <Wallet size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/tutor" />;
}
