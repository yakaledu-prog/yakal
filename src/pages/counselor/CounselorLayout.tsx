import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Users, MessagesSquare, Bell, User } from "lucide-react";

export function CounselorLayout() {
  const navItems = [
    { name: "Home", href: "/counselor", icon: <Home size={20} /> },
    { name: "Students", href: "/counselor/students", icon: <Users size={20} /> },
    { name: "Messages", href: "/counselor/messages", icon: <MessagesSquare size={20} /> },
    { name: "Notifications", href: "/counselor/notifications", icon: <Bell size={20} /> },
    { name: "Profile", href: "/counselor/profile", icon: <User size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/counselor" />;
}
