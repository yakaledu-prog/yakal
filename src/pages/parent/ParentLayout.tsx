import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Library, Users, MessagesSquareIcon, Bell, CreditCard, Map, List, Eye } from "lucide-react";

export function ParentLayout() {
  const navItems = [
    { name: "Home", href: "/parent", icon: <Home size={20} /> },
    { name: "Courses", href: "/parent/courses", icon: <Library size={20} /> },
    { name: "My Children", href: "/parent/children", icon: <Users size={20} /> },
    { name: "Roadmap", href: "/parent/roadmap", icon: <Map size={20} /> },
    { name: "College List", href: "/parent/college-list", icon: <List size={20} /> },
    { name: "Messages", href: "/parent/messages", icon: <MessagesSquareIcon size={20} /> },
    // { name: "Children's Chats", href: "/parent/child-chats", icon: <Eye size={20} /> },
    { name: "Billing", href: "/parent/billing", icon: <CreditCard size={20} /> },
    // Three candidate redesigns, side by side for comparison. Remove the two
    // that lose along with their folders.
    { name: "Billing 1", href: "/parent/billing-1", icon: <CreditCard size={20} /> },
    { name: "Billing 2", href: "/parent/billing-2", icon: <CreditCard size={20} /> },
    { name: "Billing 4", href: "/parent/billing-4", icon: <CreditCard size={20} /> },
    { name: "Notifications", href: "/parent/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/parent" />;
}
