import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Users, MessagesSquare, Bell, Calendar, History, Map, GraduationCap, Compass } from "lucide-react";

export function CounselorLayout() {
  const navItems = [
    { name: "Home", href: "/counselor", icon: <Home size={20} /> },
    { name: "Students", href: "/counselor/students", icon: <Users size={20} /> },
    { name: "Sessions", href: "/counselor/sessions", icon: <History size={20} /> },
    { name: "Calendar", href: "/counselor/calendar", icon: <Calendar size={20} /> },
    { 
      name: "College", 
      href: "/counselor/colleges", 
      icon: <GraduationCap size={20} />,
      children: [
        { name: "Roadmap", href: "/counselor/roadmap", icon: <Map size={20} /> },
        { name: "Explore", href: "/counselor/explore", icon: <Compass size={20} /> },
      ]
    },
    { name: "Messages", href: "/counselor/messages", icon: <MessagesSquare size={20} /> },
    { name: "Notifications", href: "/counselor/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/counselor" />;
}
