import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "./App";
import { AuthPage } from "../pages/shared/AuthPage";
import { EmailConfirmationPage } from "../pages/shared/EmailConfirmationPage";
import { OnboardingPage } from "../pages/shared/OnboardingPage";
import { PendingApprovalPage } from "../pages/shared/PendingApprovalPage";
import { NotFoundPage } from "../pages/shared/NotFoundPage";
import { ErrorPage } from "../pages/shared/ErrorPage";
import { SettingsPage } from "../pages/shared/SettingsPage";
import { ProposalPage } from "../pages/shared/ProposalPage";
import { StudentLayout } from "../pages/student/StudentLayout";
import { StudentHome } from "../pages/student/StudentHome";
import { StudentCalendar } from "../pages/student/StudentCalendar";
import { StudentMyLearning } from "../pages/student/StudentMyLearning";
import { StudentCourseTasks } from "../pages/student/StudentCourseTasks";
import { StudentCourseDashboard } from "../pages/student/StudentCourseDashboard";
import { StudentCourseOverview } from "../pages/student/StudentCourseOverview";
import { StudentCourseSessions } from "../pages/student/StudentCourseSessions";
import { StudentCourseResources } from "../pages/student/StudentCourseResources";
import { StudentCourses } from "../pages/student/StudentCourses";
import { StudentCourseCatalogDetail } from "../pages/student/StudentCourseCatalogDetail";
import { StudentSessions } from "../pages/student/StudentSessions";
import { StudentResources } from "../pages/student/StudentResources";
import { StudentNotifications } from "../pages/student/StudentNotifications";
import { StudentMessages } from "../pages/student/StudentMessages";
import { StudentSessionDetail } from "../pages/student/StudentSessionDetail";
import { StudentProfile } from "../pages/student/StudentProfile";
import { StudentMeeting } from "../pages/student/StudentMeeting";

import { TutorLayout } from "../pages/tutor/TutorLayout";
import { TutorHome } from "../pages/tutor/TutorHome";
import { TutorCalendar } from "../pages/tutor/TutorCalendar";
import { TutorCourses } from "../pages/tutor/TutorCourses";
import { TutorStudents } from "../pages/tutor/TutorStudents";
import { TutorAssignments } from "../pages/tutor/TutorAssignments";
import { TutorSessions } from "../pages/tutor/TutorSessions";
import { TutorNotifications } from "../pages/tutor/TutorNotifications";
import { TutorMessages } from "../pages/tutor/TutorMessages";
import { TutorSessionDetail } from "../pages/tutor/TutorSessionDetail";
import { TutorProfile } from "../pages/tutor/TutorProfile";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { homePathForRole, requiresApproval } from "../utils/roleRoutes";
import { DEV_PREVIEW } from "../config/dev";

function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const path = location.pathname;

  // Not onboarded yet -> force onboarding.
  if (profile && !profile.is_onboarded && path !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Onboarded but trying to revisit onboarding -> send to their dashboard.
  if (profile && profile.is_onboarded && path === '/onboarding') {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }

  // Approval gate: onboarded tutors/counselors who are pending or rejected
  // can only see the pending-approval screen.
  const awaitingApproval =
    !!profile &&
    profile.is_onboarded &&
    requiresApproval(profile.role) &&
    (profile.status === 'pending' || profile.status === 'rejected');

  if (awaitingApproval && path !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Anyone not awaiting approval should not sit on the pending screen.
  if (profile && !awaitingApproval && path === '/pending-approval') {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }

  return <Outlet />;
}

// ── DEV-only onboarding/pending previews ─────────────────────────────────────
// Public, no-auth routes to design/test each role's flow without logging in.
// Flag lives in src/config/dev.ts (tracked in docs/PRODUCTION_UNMOCK_CHECKLIST.md).
function OnboardingPreview() {
  const { role = "student" } = useParams();
  return <OnboardingPage previewRole={role} />;
}

function PendingPreview() {
  const { role = "tutor", status = "pending" } = useParams();
  return (
    <PendingApprovalPage
      preview
      previewRole={role}
      previewStatus={status === "rejected" ? "rejected" : "pending"}
    />
  );
}

const previewRoutes = DEV_PREVIEW
  ? [
      { path: "/preview/onboarding/:role", element: <OnboardingPreview /> },
      { path: "/preview/pending/:role/:status?", element: <PendingPreview /> },
    ]
  : [];

const router = createBrowserRouter([
  ...previewRoutes,
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/login",
    element: <AuthPage />,
  },
  {
    path: "/proposal",
    element: <ProposalPage />,
  },
  {
    path: "/confirm-email",
    element: <EmailConfirmationPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "onboarding",
        element: <OnboardingPage />,
      },
      {
        path: "pending-approval",
        element: <PendingApprovalPage />,
      },
      {
        path: "admin/*",
        element: <div>Admin Dashboard (Placeholder)</div>,
      },
      {
        path: "counselor/*",
        element: <div>Counselor Dashboard (Placeholder)</div>,
      },
      {
        path: "tutor",
        element: <TutorLayout />,
        children: [
          { path: "", element: <TutorHome /> },
          { path: "students", element: <TutorStudents /> },
          { path: "sessions", element: <TutorSessions /> },
          { path: "session/:id", element: <TutorSessionDetail /> },
          { path: "calendar", element: <TutorCalendar /> },
          { path: "courses", element: <TutorCourses /> },
          { path: "assignments", element: <TutorAssignments /> },
          { path: "messages", element: <TutorMessages /> },
          { path: "profile", element: <TutorProfile /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "notifications", element: <TutorNotifications /> },
          { path: "*", element: <NotFoundPage /> },
        ]
      },
      {
        path: "parent/*",
        element: <div>Parent Dashboard (Placeholder)</div>,
      },
      {
        path: "student",
        element: <StudentLayout />,
        children: [
          { path: "", element: <StudentHome /> },
          { path: "calendar", element: <StudentCalendar /> },
          { path: "my-learning", element: <StudentMyLearning /> },
          { 
            path: "my-learning/:courseId", 
            element: <StudentCourseDashboard />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: "overview", element: <StudentCourseOverview /> },
              { path: "tasks", element: <StudentCourseTasks /> },
              { path: "sessions", element: <StudentCourseSessions /> },
              { path: "resources", element: <StudentCourseResources /> },
            ]
          },
          { path: "session/:id", element: <StudentSessionDetail /> },
          { path: "messages", element: <StudentMessages /> },
          { path: "sessions", element: <StudentSessions /> },
          { path: "courses", element: <StudentCourses /> },
          { path: "courses/:courseId", element: <StudentCourseCatalogDetail /> },
          { path: "resources", element: <StudentResources /> },
          { path: "profile", element: <StudentProfile /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "notifications", element: <StudentNotifications /> },
          { path: "meeting/:sessionId", element: <StudentMeeting /> },
          { path: "*", element: <NotFoundPage /> },
        ]
      }
    ]
  },
  {
    path: "*",
    element: <NotFoundPage />,
  }
]);

export function AppRouter() {
  return (
    <AuthProvider>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
