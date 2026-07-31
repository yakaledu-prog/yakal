import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Users, Library, CreditCard, Bell, FileText, FeatherIcon, PencilRulerIcon, UserCheck } from "lucide-react";

export function AdminLayout() {
  // Profile is reached via the sidebar footer avatar (links to /admin/profile),
  // so it is intentionally not a nav item here.
  const navItems = [
    { name: "Home", href: "/admin", icon: <Home size={20} /> },
    { name: "Users", href: "/admin/users", icon: <Users size={20} /> },
    { name: "Applicants", href: "/admin/applicants", icon: <UserCheck size={20} /> },
    { name: "Courses", href: "/admin/courses", icon: <Library size={20} /> },
    { name: "Posts", href: "/admin/posts", icon: <PencilRulerIcon size={20} /> },
    { name: "Billing", href: "/admin/billing", icon: <CreditCard size={20} /> },
    { name: "Notifications", href: "/admin/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/admin" />;
}
