import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Library, Users, MessagesSquareIcon, Bell, CreditCard, Map, Compass, GraduationCap } from "lucide-react";

export function ParentLayout() {
  // The billing and course-booking alternatives still exist and their routes
  // still work, but they are not product. They are listed in the developer
  // console instead, so a client sees one billing page and one way to book.
  // The roadmap and the catalogue are pages, grouped rather than listed flat:
  // each carries its own tabs or filter rail, and nesting them in the child's
  // record put the thing you came to read three rows of tabs down. The college
  // list has none of that, so it stays a tab on the child.
  const navItems = [
    { name: "Home", href: "/parent", icon: <Home size={20} /> },
    { name: "Courses", href: "/parent/courses", icon: <Library size={20} /> },
    { name: "My Children", href: "/parent/children", icon: <Users size={20} /> },
    {
      name: "College",
      icon: <GraduationCap size={20} />,
      children: [
        { name: "Roadmap", href: "/parent/roadmap", icon: <Map size={18} /> },
        { name: "Explore", href: "/parent/explore", icon: <Compass size={18} /> },
      ],
    },
    { name: "Messages", href: "/parent/messages", icon: <MessagesSquareIcon size={20} /> },
    { name: "Counselling", href: "/parent/admissions", icon: <GraduationCap size={20} /> },
    { name: "Billing", href: "/parent/billing", icon: <CreditCard size={20} /> },
    { name: "Notifications", href: "/parent/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/parent" />;
}
