import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Library, Users, MessagesSquareIcon, Bell, CreditCard, Map, List, Compass, GraduationCap } from "lucide-react";

export function ParentLayout() {
  // The billing and course-booking alternatives still exist and their routes
  // still work, but they are not product. They are listed in the developer
  // console instead, so a client sees one billing page and one way to book.
  // The three college pages are grouped rather than listed flat. Each carries
  // its own tabs and filter rails, which is why they are pages and not tabs on
  // the child's record: nesting them there put the thing you came to read
  // three rows of tabs down.
  const navItems = [
    { name: "Home", href: "/parent", icon: <Home size={20} /> },
    { name: "Courses", href: "/parent/courses", icon: <Library size={20} /> },
    { name: "My Children", href: "/parent/children", icon: <Users size={20} /> },
    {
      name: "College",
      icon: <GraduationCap size={20} />,
      children: [
        { name: "Roadmap", href: "/parent/roadmap", icon: <Map size={18} /> },
        { name: "College List", href: "/parent/college-list", icon: <List size={18} /> },
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
