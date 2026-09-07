import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Users, MessagesSquare, Bell, Calendar, History, Map, GraduationCap, Compass, Wallet, FileText } from "lucide-react";

export function CounselorLayout() {
  const navItems = [
    { name: "Home", href: "/counselor", icon: <Home size={20} /> },
    { name: "Students", href: "/counselor/students", icon: <Users size={20} /> },
    { name: "Calendar", href: "/counselor/calendar", icon: <Calendar size={20} /> },
    { 
      name: "College",
      // No href. A group is a container for links, not a link itself, and
      // this carried /counselor/colleges, which is not a route: harmless while
      // nothing followed it, and a not-found page for anything that did.
      icon: <GraduationCap size={20} />,
      children: [
        // Advising belongs with the rest of the college work rather than
        // above it: for a counsellor every session is an advising session, so
        // a top-level Sessions entry said nothing the group does not.
        { name: "Advising", href: "/counselor/sessions", icon: <History size={20} /> },
        { name: "Roadmap", href: "/counselor/roadmap", icon: <Map size={20} /> },
        { name: "Essays", href: "/counselor/essays", icon: <FileText size={20} /> },
        { name: "Explore", href: "/counselor/explore", icon: <Compass size={20} /> },
      ]
    },
    { name: "Messages", href: "/counselor/messages", icon: <MessagesSquare size={20} /> },
    { name: "Notifications", href: "/counselor/notifications", icon: <Bell size={20} /> },
    { name: "Earnings", href: "/counselor/earnings", icon: <Wallet size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/counselor" />;
}
