import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Home, Calendar, CheckSquare, Bell, History, MessagesSquareIcon, Map, List, ClipboardList, Activity, Compass, GraduationCap } from "lucide-react";
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

  const navItems = [
    { name: "Home", href: "/student", icon: <Home size={20} /> },
    { name: "My Learning", href: "/student/my-learning", icon: <CheckSquare size={20} />, isLocked: !hasTutoring, lockedBy: "tutoring" },
    { name: "Diagnostics", href: "/student/diagnostics", icon: <Activity size={20} />, badge: incompleteDiagnostics, isLocked: !hasTutoring, lockedBy: "tutoring" },
    { name: "Calendar", href: "/student/calendar", icon: <Calendar size={20} /> },
    { name: "Sessions", href: "/student/sessions", icon: <History size={20} />, isLocked: !hasTutoring, lockedBy: "tutoring" },
    {
      name: "College",
      href: "/student/college-list",
      icon: <GraduationCap size={20} />,
      children: [
        { name: "Roadmap", href: "/student/roadmap", icon: <Map size={18} /> },
        { name: "Explore", href: "/student/explore", icon: <Compass size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
        { name: "My list", href: "/student/college-list", icon: <List size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
        { name: "Applications", href: "/student/my-app", icon: <ClipboardList size={18} />, isLocked: !hasAdmissions, lockedBy: "admissions" },
      ],
    },
    { name: "Messages", href: "/student/messages", icon: <MessagesSquareIcon size={20} /> },
    { name: "Notifications", href: "/student/notifications", icon: <Bell size={20} /> },
  ];

  return <DashboardLayout navItems={navItems} basePath="/student" />;
}
