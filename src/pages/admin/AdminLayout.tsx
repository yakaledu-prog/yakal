import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Users, Library, CreditCard, Mail, User } from "lucide-react";

export function AdminLayout() {
  const navItems = [
    { name: "Home", href: "/admin", icon: <Home size={20} /> },
    { name: "Users", href: "/admin/users", icon: <Users size={20} /> },
    { name: "Courses", href: "/admin/courses", icon: <Library size={20} /> },
    { name: "Billing", href: "/admin/billing", icon: <CreditCard size={20} /> },
    { name: "Contact", href: "/admin/contact", icon: <Mail size={20} /> },
    { name: "Profile", href: "/admin/profile", icon: <User size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/admin" />;
}
