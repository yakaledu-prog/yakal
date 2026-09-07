import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { CalendarDays, Home, Calendar, CheckSquare, Bell, History, MessagesSquareIcon, Map, List, ClipboardList, Activity, Compass, GraduationCap, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { diagnosticService } from "@/services/diagnosticService";
import { diagnosticTests } from "@/data/diagnostics";
import { getMyActiveServices } from "@/services/parentService";

export function StudentLayout() {
  const { user } = useAuth();
  const [completedDiagnostics, setCompletedDiagnostics] = useState(0);

  useEffect(() => {
    if (user) {
      diagnosticService.getStudentResults(user.id).then(results => {
        setCompletedDiagnostics(results.length);
      });
    }
  }, [user]);

  const incompleteDiagnostics = Math.max(0, diagnosticTests.length - completedDiagnostics);

  // Which services a parent has turned on for this student. It used to read
  // profile.active_services, a column that does not exist on profiles, so it
  // was always undefined and the college pages were locked for everybody.
  const { data: activeServices = [] } = useQuery({
    queryKey: ["my-services", user?.id],
    queryFn: () => getMyActiveServices(user!.id),
    enabled: !!user?.id,
  });
  const hasAdmissions = activeServices.includes("admissions");
  const hasTutoring = activeServices.includes("tutoring");

  // Five at most in the bottom bar on a phone, and they are the ones a student
  // opens constantly rather than the first five the sidebar lists. Everything
  // else stays in the drawer behind the menu button.
  //
  // Two of them are groups. A group is not a link in the sidebar, but its href
  // is the child it opens on, which is a real destination: on a phone
  // "Tutoring" should go straight to My Learning rather than expand a list.
  //
  // Notifications is never here: it is a bell in the topbar with its own
  // unread count, and a second entry point would compete with it.
  const navItems = [
    { name: "Home", href: "/student", icon: <Home size={20} />, mobile: true },
    // Outside both groups on purpose. A calendar answers "what is my week",
    // which is not a question about one service or the other.
    { name: "Calendar", href: "/student/calendar", icon: <Calendar size={20} />, mobile: true },
    {
      // Grouped rather than merged. Each of these does a different job and the
      // accordion only says which service it belongs to, which is the thing a
      // student actually needs to know: one of these is what a parent paid for
      // and the other may not be.
      name: "Tutoring",
      href: "/student/my-learning",
      icon: <BookOpen size={20} />,
      mobile: true,
      children: [
        { name: "My Learning", href: "/student/my-learning", icon: <CheckSquare size={18} />, isLocked: !hasTutoring, lockedBy: "tutoring" },
        { name: "Diagnostics", href: "/student/diagnostics", icon: <Activity size={18} />, badge: incompleteDiagnostics, isLocked: !hasTutoring, lockedBy: "tutoring" },
        // "Lessons", not "Sessions". Advising hours are sessions too, and a
        // list that says Sessions while showing only half of them is a lie the
        // College group next to it makes obvious.
        { name: "Lessons", href: "/student/sessions", icon: <History size={18} />, isLocked: !hasTutoring, lockedBy: "tutoring" },
      ],
    },
    {
      name: "College",
      href: "/student/college-list",
      icon: <GraduationCap size={20} />,
      mobile: true,
      children: [
        { name: "Roadmap", href: "/student/roadmap", icon: <Map size={18} /> },
        { name: "Explore", href: "/student/explore", icon: <Compass size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
        { name: "My list", href: "/student/college-list", icon: <List size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
        // Its own entry, because Lessons is locked behind tutoring: a family
        // who bought counselling and nothing else could not see the hours they
        // were paying for anywhere at all.
        { name: "Advising", href: "/student/advising", icon: <CalendarDays size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
        { name: "Applications", href: "/student/my-app", icon: <ClipboardList size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
      ],
    },
    { name: "Messages", href: "/student/messages", icon: <MessagesSquareIcon size={20} />, mobile: true },
    { name: "Notifications", href: "/student/notifications", icon: <Bell size={20} /> },
  ];
  return <DashboardLayout navItems={navItems} basePath="/student" />;
}
