import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Library, Users, MessagesSquareIcon, Bell } from "lucide-react";

export function ParentLayout() {
  const navItems = [
    { name: "Home", href: "/parent", icon: <Home size={20} /> },
    { name: "Courses", href: "/parent/courses", icon: <Library size={20} /> },
    { name: "My Children", href: "/parent/children", icon: <Users size={20} /> },
    { name: "Messages", href: "/parent/messages", icon: <MessagesSquareIcon size={20} /> },
    { name: "Notifications", href: "/parent/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/parent" />;
}
