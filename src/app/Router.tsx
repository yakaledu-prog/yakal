import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { Toaster } from "sonner";

import App from "./App";
import { AuthPage } from "../pages/shared/AuthPage";
import { EmailConfirmationPage } from "../pages/shared/EmailConfirmationPage";
import { OnboardingPage } from "../pages/shared/OnboardingPage";
import { PendingApprovalPage } from "../pages/shared/PendingApprovalPage";
import { NotFoundPage } from "../pages/shared/NotFoundPage";
import { ErrorPage } from "../pages/shared/ErrorPage";
import { SettingsPage } from "../pages/shared/SettingsPage";
import { ProposalPage } from "../pages/shared/ProposalPage";
import { StudentDiagnosticOnboardingPreview } from "../pages/preview/StudentDiagnosticOnboardingPreview";
import LandingV1 from "../pages/LandingV1";
import LandingV2 from "../pages/LandingV2";
import LandingV3 from "../pages/LandingV3";
import LandingV4 from "../pages/LandingV4";
import LandingV5 from "../pages/LandingV5";
import { CancellationPolicyPage } from "../pages/shared/CancellationPolicyPage";
import { TermsConditionsPage } from "../pages/shared/TermsConditionsPage";
import { PrivacyPolicyPage } from "../pages/shared/PrivacyPolicyPage";
import { CookiePreferencesPage } from "../pages/shared/CookiePreferencesPage";
import { StudentLayout } from "../pages/student/StudentLayout";
import { StudentHome } from "../pages/student/StudentHome";
import { StudentCalendar } from "../pages/student/StudentCalendar";
import { StudentCourseTasks } from "../pages/student/StudentCourseTasks";
import { StudentCourseDashboard } from "../pages/student/StudentCourseDashboard";
import { StudentCourseOverview } from "../pages/student/StudentCourseOverview";
import { StudentCourseSessions } from "../pages/student/StudentCourseSessions";
import { StudentCourseMessages } from "../pages/student/StudentCourseMessages";
import { StudentCourseCatalogDetail } from "../pages/student/StudentCourseCatalogDetail";
import { StudentSessions } from "../pages/student/StudentSessions";
import { StudentResources } from "../pages/student/StudentResources";
import { StudentNotifications } from "../pages/student/StudentNotifications";
import { StudentMessages } from "../pages/student/StudentMessages";
import { StudentRoadmap } from "../pages/student/StudentRoadmap";
import { StudentCollegeList } from "../pages/student/StudentCollegeList";
import { StudentApplicationTracker } from "../pages/student/StudentApplicationTracker";
import { StudentSessionDetail } from "../pages/student/StudentSessionDetail";
import { StudentProfile } from "../pages/student/StudentProfile";
import { StudentMeeting } from "../pages/student/StudentMeeting";
import { StudentDiagnostics } from "../pages/student/StudentDiagnostics";

import { TutorLayout } from "../pages/tutor/TutorLayout";
import { TutorHome } from "../pages/tutor/TutorHome";
import { TutorCalendar } from "../pages/tutor/TutorCalendar";
import { TutorCourses } from "../pages/tutor/TutorCourses";
import { TutorStudents } from "../pages/tutor/TutorStudents";
import { TutorAssignments } from "../pages/tutor/TutorAssignments";
import { TutorAssignmentNew } from "../pages/tutor/TutorAssignmentNew";
import { TutorAssignmentDetail } from "../pages/tutor/TutorAssignmentDetail";
import { TutorEarnings } from "../pages/tutor/TutorEarnings";
import { TutorSessions } from "../pages/tutor/TutorSessions";
import { TutorNotifications } from "../pages/tutor/TutorNotifications";
import { TutorMessages } from "../pages/tutor/TutorMessages";
import { TutorSessionDetail } from "../pages/tutor/TutorSessionDetail";
import { TutorMeeting } from "../pages/tutor/TutorMeeting";
import { CounselorLayout } from "../pages/counselor/CounselorLayout";
import { CounselorHome } from "../pages/counselor/CounselorHome";
import { CounselorStudents } from "../pages/counselor/CounselorStudents";
import { CounselorStudentDetail } from "../pages/counselor/CounselorStudentDetail";
import { CounselorMessages } from "../pages/counselor/CounselorMessages";
import { CounselorNotifications } from "../pages/counselor/CounselorNotifications";
import { CounselorProfile } from "../pages/counselor/CounselorProfile";
import { AdminLayout } from "../pages/admin/AdminLayout";
import { AdminHome } from "../pages/admin/AdminHome";
import { AdminUsers } from "../pages/admin/AdminUsers";
import { AdminCourses } from "../pages/admin/AdminCourses";
import { AdminPosts } from "../pages/admin/cms/AdminPosts";
import { AdminPostEditor } from "../pages/admin/cms/AdminPostEditor";
import { AdminBilling } from "../pages/admin/AdminBilling";
import { AdminContact } from "../pages/admin/AdminContact";
import { AdminProfile } from "../pages/admin/AdminProfile";
import { TutorProfile } from "../pages/tutor/TutorProfile";

import { ParentLayout } from "../pages/parent/ParentLayout";
import { ParentHome } from "../pages/parent/ParentHome";
import { ParentCourses } from "../pages/parent/ParentCourses";
import { ParentCourseCatalogDetail } from "../pages/parent/ParentCourseCatalogDetail";
import { ParentChildren } from "../pages/parent/ParentChildren";
import { ParentMessages } from "../pages/parent/ParentMessages";
import { ParentProfile } from "../pages/parent/ParentProfile";
import { ParentBilling } from "../pages/parent/ParentBilling";
import { ParentRoadmap } from "../pages/parent/ParentRoadmap";
import { ParentCollegeList } from "../pages/parent/ParentCollegeList";
import { ParentChildChats } from "../pages/parent/ParentChildChats";
import { ParentNotifications } from "../pages/parent/ParentNotifications";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { homePathForRole, requiresApproval } from "../utils/roleRoutes";
import { DEV_PREVIEW } from "../config/dev";
import { BreadcrumbProvider } from "../contexts/BreadcrumbContext";

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

// -- DEV-only onboarding/pending previews -------------------------------------
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
    path: "/cancellation-policy",
    element: <CancellationPolicyPage />,
  },
  {
    path: "/terms",
    element: <TermsConditionsPage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPolicyPage />,
  },
  {
    path: "/cookies",
    element: <CookiePreferencesPage />,
  },
  // -- Landing page service-section design previews -------------------------
  { path: "/landing/1", element: <LandingV1 /> },
  { path: "/landing/2", element: <LandingV2 /> },
  { path: "/landing/3", element: <LandingV3 /> },
  { path: "/landing/4", element: <LandingV4 /> },
  { path: "/landing/5", element: <LandingV5 /> },
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
        path: "admin",
        element: <AdminLayout />,
        children: [
          { path: "", element: <AdminHome /> },
          { path: "users", element: <AdminUsers /> },
          { path: "courses", element: <AdminCourses /> },
          { path: "posts", element: <AdminPosts /> },
          { path: "posts/new", element: <AdminPostEditor /> },
          { path: "posts/:id/edit", element: <AdminPostEditor /> },
          { path: "billing", element: <AdminBilling /> },
          { path: "notifications", element: <AdminContact /> },
          { path: "profile", element: <AdminProfile /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ]
      },
      {
        path: "counselor",
        element: <CounselorLayout />,
        children: [
          { path: "", element: <CounselorHome /> },
          { path: "students", element: <CounselorStudents /> },
          { path: "students/:id", element: <CounselorStudentDetail /> },
          { path: "messages", element: <CounselorMessages /> },
          { path: "notifications", element: <CounselorNotifications /> },
          { path: "profile", element: <CounselorProfile /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ]
      },
      {
        path: "tutor",
        element: <TutorLayout />,
        children: [
          { path: "", element: <TutorHome /> },
          { path: "students", element: <TutorStudents /> },
          { path: "students/:id", element: <TutorStudents /> },
          { path: "sessions", element: <TutorSessions /> },
          { path: "session/:id", element: <TutorSessionDetail /> },
          { path: "meeting/:sessionId", element: <TutorMeeting /> },
          { path: "calendar", element: <TutorCalendar /> },
          { path: "courses", element: <TutorCourses /> },
          { path: "courses/:id", element: <TutorCourses /> },
          { path: "earnings", element: <TutorEarnings /> },
          { path: "assignments", element: <TutorAssignments /> },
          { path: "assignments/new", element: <TutorAssignmentNew /> },
          { path: "assignments/:id", element: <TutorAssignmentDetail /> },
          { path: "messages", element: <TutorMessages /> },
          { path: "profile", element: <TutorProfile /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "notifications", element: <TutorNotifications /> },
          { path: "*", element: <NotFoundPage /> },
        ]
      },
      {
        path: "parent",
        element: <ParentLayout />,
        children: [
          { path: "", element: <ParentHome /> },
          { path: "courses", element: <ParentCourses /> },
          { path: "courses/:id", element: <ParentCourseCatalogDetail /> },
          { path: "children", element: <ParentChildren /> },
          { path: "children/:id", element: <ParentChildren /> },
          { path: "messages", element: <ParentMessages /> },
          { path: "roadmap", element: <ParentRoadmap /> },
          { path: "college-list", element: <ParentCollegeList /> },
          { path: "child-chats", element: <ParentChildChats /> },
          { path: "billing", element: <ParentBilling /> },
          { path: "profile", element: <ParentProfile /> },
          { path: "notifications", element: <ParentNotifications /> },
          { path: "*", element: <NotFoundPage /> },
        ]
      },
      {
        path: "student",
        element: <StudentLayout />,
        children: [
          { path: "", element: <StudentHome /> },
          { path: "calendar", element: <StudentCalendar /> },
          { path: "my-learning", element: <Navigate to="/student/my-learning/CAT-01/overview" replace /> },
          {
            path: "my-learning/:courseId",
            element: <StudentCourseDashboard />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: "overview", element: <StudentCourseOverview /> },
              { path: "tasks", element: <StudentCourseTasks /> },
              { path: "sessions", element: <StudentCourseSessions /> },
              { path: "messages", element: <StudentCourseMessages /> },
            ]
          },
          { path: "session/:id", element: <StudentSessionDetail /> },
          { path: "messages", element: <StudentMessages /> },
          { path: "roadmap", element: <StudentRoadmap /> },
          { path: "diagnostics", element: <StudentDiagnostics /> },
          { path: "college-list", element: <StudentCollegeList /> },
          { path: "my-app", element: <StudentApplicationTracker /> },
          { path: "sessions", element: <StudentSessions /> },
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
    path: "/preview/split-onboarding",
    element: <StudentDiagnosticOnboardingPreview />
  },
  {
    path: "*",
    element: <NotFoundPage />,
  }
]);

export function AppRouter() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          classNames: {
            success: '!bg-[#1099A1aa] !border-none !text-white',
            warning: '!bg-[#CAA25F] !border-none !text-white',
            error: '!bg-[#ef4444] !border-none !text-white'
          }
        }}
      />
      <BreadcrumbProvider>
        <RouterProvider router={router} />
      </BreadcrumbProvider>
    </AuthProvider>
  );
}
