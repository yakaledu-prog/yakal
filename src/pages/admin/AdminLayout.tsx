import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Home,
  Users,
  Library,
  CreditCard,
  Bell,
  Flag,
  PencilRulerIcon,
  UserCheck,
  Quote,
  ClipboardList,
  GraduationCap,
  Mail,
  FileText,
  Contact,
  Briefcase,
  Globe,
} from "lucide-react";

export function AdminLayout() {
  // Profile is reached via the sidebar footer avatar (links to /admin/profile),
  // so it is intentionally not a nav item here.
  //
  // Grouped by what the work is about, the same way the parent's College group
  // is. Thirteen flat links made the rail a list to read rather than scan, and
  // the daily things (Billing, Reports) sat between pages visited once a
  // month. Those two stay top level because they are queues somebody works
  // through; the groups hold setup that changes rarely.
  const navItems = [
    { name: "Home", href: "/admin", icon: <Home size={20} /> },
    {
      name: "People",
      icon: <Contact size={20} />,
      children: [
        { name: "Users", href: "/admin/users", icon: <Users size={18} /> },
        { name: "Applicants", href: "/admin/applicants", icon: <UserCheck size={18} /> },
      ],
    },
    {
      // What is sold, and the diagnostic students take before choosing.
      name: "Services",
      icon: <Briefcase size={20} />,
      children: [
        { name: "Courses", href: "/admin/courses", icon: <Library size={18} /> },
        { name: "Admissions", href: "/admin/admissions", icon: <GraduationCap size={18} /> },
        { name: "Essay prompts", href: "/admin/essay-prompts", icon: <FileText size={18} /> },
        { name: "Diagnostics", href: "/admin/diagnostics", icon: <ClipboardList size={18} /> },
      ],
    },
    { name: "Billing", href: "/admin/billing", icon: <CreditCard size={20} /> },
    { name: "Reports", href: "/admin/reports", icon: <Flag size={20} /> },
    {
      // The public site: what a visitor reads, and who signed up to hear more.
      name: "Website",
      icon: <Globe size={20} />,
      children: [
        { name: "Posts", href: "/admin/posts", icon: <PencilRulerIcon size={18} /> },
        { name: "Testimonials", href: "/admin/testimonials", icon: <Quote size={18} /> },
        { name: "Subscribers", href: "/admin/subscribers", icon: <Mail size={18} /> },
      ],
    },
    { name: "Notifications", href: "/admin/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/admin" />;
}
