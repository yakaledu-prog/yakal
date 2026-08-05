import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { Toaster } from "sonner";

// ============================================================
// Pages are loaded when they are first visited.
//
// Imported eagerly, all ninety of them ended up in one bundle: a student
// on a phone downloaded the admin dashboard, the counselor tools and the
// tutor earnings pages before their homework could render. Nearly a
// megabyte gzipped, before a single pixel.
//
// Each page resolves its own named export because lazy() wants a default
// and these files do not have one. Layouts stay eager: they are on every
// route, so splitting them would only add a request.
// ============================================================

const AdminApplicants = lazy(() => import("../pages/admin/AdminApplicants").then((m) => ({ default: m.AdminApplicants })));
const AdminBilling = lazy(() => import("../pages/admin/AdminBilling").then((m) => ({ default: m.AdminBilling })));
const AdminContact = lazy(() => import("../pages/admin/AdminContact").then((m) => ({ default: m.AdminContact })));
const AdminCourseDetail = lazy(() => import("../pages/admin/AdminCourseDetail").then((m) => ({ default: m.AdminCourseDetail })));
const AdminCourses = lazy(() => import("../pages/admin/AdminCourses").then((m) => ({ default: m.AdminCourses })));
const AdminHome = lazy(() => import("../pages/admin/AdminHome").then((m) => ({ default: m.AdminHome })));
const AdminLayout = lazy(() => import("../pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const AdminPostEditor = lazy(() => import("../pages/admin/cms/AdminPostEditor").then((m) => ({ default: m.AdminPostEditor })));
const AdminPosts = lazy(() => import("../pages/admin/cms/AdminPosts").then((m) => ({ default: m.AdminPosts })));
const AdminProfile = lazy(() => import("../pages/admin/AdminProfile").then((m) => ({ default: m.AdminProfile })));
const AdminReports = lazy(() => import("../pages/admin/AdminReports").then((m) => ({ default: m.AdminReports })));
const AdminUsers = lazy(() => import("../pages/admin/AdminUsers").then((m) => ({ default: m.AdminUsers })));
const Billing1 = lazy(() => import("../pages/parent/billing/Billing1").then((m) => ({ default: m.Billing1 })));
const Billing2 = lazy(() => import("../pages/parent/billing/Billing2").then((m) => ({ default: m.Billing2 })));
const Billing4 = lazy(() => import("../pages/parent/billing/Billing4").then((m) => ({ default: m.Billing4 })));
const BookingV1 = lazy(() => import("../pages/parent/booking/BookingV1").then((m) => ({ default: m.BookingV1 })));
const BookingV2 = lazy(() => import("../pages/parent/booking/BookingV2").then((m) => ({ default: m.BookingV2 })));
const CancellationPolicyPage = lazy(() => import("../pages/shared/CancellationPolicyPage").then((m) => ({ default: m.CancellationPolicyPage })));
const CollegeListPreview = lazy(() => import("../pages/preview/CollegeListPreview").then((m) => ({ default: m.CollegeListPreview })));
const CookiePreferencesPage = lazy(() => import("../pages/shared/CookiePreferencesPage").then((m) => ({ default: m.CookiePreferencesPage })));
const CounselorEarnings = lazy(() => import("../pages/counselor/CounselorEarnings").then((m) => ({ default: m.CounselorEarnings })));
const CounselorEssays = lazy(() => import("../pages/counselor/CounselorEssays").then((m) => ({ default: m.CounselorEssays })));
const CounselorExplore = lazy(() => import("../pages/counselor/CounselorExplore").then((m) => ({ default: m.CounselorExplore })));
const CounselorHome = lazy(() => import("../pages/counselor/CounselorHome").then((m) => ({ default: m.CounselorHome })));
const CounselorLayout = lazy(() => import("../pages/counselor/CounselorLayout").then((m) => ({ default: m.CounselorLayout })));
const CounselorMessages = lazy(() => import("../pages/counselor/CounselorMessages").then((m) => ({ default: m.CounselorMessages })));
const CounselorNotifications = lazy(() => import("../pages/counselor/CounselorNotifications").then((m) => ({ default: m.CounselorNotifications })));
const CounselorProfile = lazy(() => import("../pages/counselor/CounselorProfile").then((m) => ({ default: m.CounselorProfile })));
const CounselorStudents = lazy(() => import("../pages/counselor/CounselorStudents").then((m) => ({ default: m.CounselorStudents })));
const DevConsole = lazy(() => import("../pages/dev/DevConsole").then((m) => ({ default: m.DevConsole })));
const EmailConfirmationPage = lazy(() => import("../pages/shared/EmailConfirmationPage").then((m) => ({ default: m.EmailConfirmationPage })));
const OnboardingPage = lazy(() => import("../pages/shared/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));
const ParentAdmissions = lazy(() => import("../pages/parent/ParentAdmissions").then((m) => ({ default: m.ParentAdmissions })));
const ParentBilling = lazy(() => import("../pages/parent/ParentBilling").then((m) => ({ default: m.ParentBilling })));
const ParentChildChats = lazy(() => import("../pages/parent/ParentChildChats").then((m) => ({ default: m.ParentChildChats })));
const ParentChildren = lazy(() => import("../pages/parent/ParentChildren").then((m) => ({ default: m.ParentChildren })));
const ParentCourseCatalogDetail = lazy(() => import("../pages/parent/ParentCourseCatalogDetail").then((m) => ({ default: m.ParentCourseCatalogDetail })));
const ParentCourses = lazy(() => import("../pages/parent/ParentCourses").then((m) => ({ default: m.ParentCourses })));
const ParentExplore = lazy(() => import("../pages/parent/ParentExplore").then((m) => ({ default: m.ParentExplore })));
const ParentHome = lazy(() => import("../pages/parent/ParentHome").then((m) => ({ default: m.ParentHome })));
const ParentLayout = lazy(() => import("../pages/parent/ParentLayout").then((m) => ({ default: m.ParentLayout })));
const ParentMessages = lazy(() => import("../pages/parent/ParentMessages").then((m) => ({ default: m.ParentMessages })));
const ParentNotifications = lazy(() => import("../pages/parent/ParentNotifications").then((m) => ({ default: m.ParentNotifications })));
const ParentProfile = lazy(() => import("../pages/parent/ParentProfile").then((m) => ({ default: m.ParentProfile })));
const ParentRoadmap = lazy(() => import("../pages/parent/ParentRoadmap").then((m) => ({ default: m.ParentRoadmap })));
const PendingApprovalPage = lazy(() => import("../pages/shared/PendingApprovalPage").then((m) => ({ default: m.PendingApprovalPage })));
const PrivacyPolicyPage = lazy(() => import("../pages/shared/PrivacyPolicyPage").then((m) => ({ default: m.PrivacyPolicyPage })));
const ProposalPage = lazy(() => import("../pages/shared/ProposalPage").then((m) => ({ default: m.ProposalPage })));
const SettingsPage = lazy(() => import("../pages/shared/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const StudentApplicationTracker = lazy(() => import("../pages/student/StudentApplicationTracker").then((m) => ({ default: m.StudentApplicationTracker })));
const StudentCalendar = lazy(() => import("../pages/student/StudentCalendar").then((m) => ({ default: m.StudentCalendar })));
const StudentCollegeList = lazy(() => import("../pages/student/StudentCollegeList").then((m) => ({ default: m.StudentCollegeList })));
const StudentCourseCatalogDetail = lazy(() => import("../pages/student/StudentCourseCatalogDetail").then((m) => ({ default: m.StudentCourseCatalogDetail })));
const StudentCourseDashboard = lazy(() => import("../pages/student/StudentCourseDashboard").then((m) => ({ default: m.StudentCourseDashboard })));
const StudentCourseMessages = lazy(() => import("../pages/student/StudentCourseMessages").then((m) => ({ default: m.StudentCourseMessages })));
const StudentCourseSessions = lazy(() => import("../pages/student/StudentCourseSessions").then((m) => ({ default: m.StudentCourseSessions })));
const StudentCourseTasks = lazy(() => import("../pages/student/StudentCourseTasks").then((m) => ({ default: m.StudentCourseTasks })));
const StudentDiagnosticOnboardingPreview = lazy(() => import("../pages/preview/StudentDiagnosticOnboardingPreview").then((m) => ({ default: m.StudentDiagnosticOnboardingPreview })));
const StudentDiagnostics = lazy(() => import("../pages/student/StudentDiagnostics").then((m) => ({ default: m.StudentDiagnostics })));
const StudentExploreUniversities = lazy(() => import("../pages/student/StudentExploreUniversities").then((m) => ({ default: m.StudentExploreUniversities })));
const StudentHome = lazy(() => import("../pages/student/StudentHome").then((m) => ({ default: m.StudentHome })));
const StudentLayout = lazy(() => import("../pages/student/StudentLayout").then((m) => ({ default: m.StudentLayout })));
const StudentMeeting = lazy(() => import("../pages/student/StudentMeeting").then((m) => ({ default: m.StudentMeeting })));
const StudentMessages = lazy(() => import("../pages/student/StudentMessages").then((m) => ({ default: m.StudentMessages })));
const StudentNotifications = lazy(() => import("../pages/student/StudentNotifications").then((m) => ({ default: m.StudentNotifications })));
const StudentProfile = lazy(() => import("../pages/student/StudentProfile").then((m) => ({ default: m.StudentProfile })));
const StudentRoadmap = lazy(() => import("../pages/student/StudentRoadmap").then((m) => ({ default: m.StudentRoadmap })));
const StudentSessionDetail = lazy(() => import("../pages/student/StudentSessionDetail").then((m) => ({ default: m.StudentSessionDetail })));
const StudentSessions = lazy(() => import("../pages/student/StudentSessions").then((m) => ({ default: m.StudentSessions })));
const TermsConditionsPage = lazy(() => import("../pages/shared/TermsConditionsPage").then((m) => ({ default: m.TermsConditionsPage })));
const TrackerPreview = lazy(() => import("../pages/preview/TrackerPreview").then((m) => ({ default: m.TrackerPreview })));
const TutorCalendar = lazy(() => import("../pages/tutor/TutorCalendar").then((m) => ({ default: m.TutorCalendar })));
const TutorCourseCatalog = lazy(() => import("../pages/tutor/TutorCourseCatalog").then((m) => ({ default: m.TutorCourseCatalog })));
const TutorCourses = lazy(() => import("../pages/tutor/TutorCourses").then((m) => ({ default: m.TutorCourses })));
const TutorEarnings = lazy(() => import("../pages/tutor/TutorEarnings").then((m) => ({ default: m.TutorEarnings })));
const TutorHome = lazy(() => import("../pages/tutor/TutorHome").then((m) => ({ default: m.TutorHome })));
const TutorLayout = lazy(() => import("../pages/tutor/TutorLayout").then((m) => ({ default: m.TutorLayout })));
const TutorMeeting = lazy(() => import("../pages/tutor/TutorMeeting").then((m) => ({ default: m.TutorMeeting })));
const TutorMessages = lazy(() => import("../pages/tutor/TutorMessages").then((m) => ({ default: m.TutorMessages })));
const TutorNotifications = lazy(() => import("../pages/tutor/TutorNotifications").then((m) => ({ default: m.TutorNotifications })));
const TutorProfile = lazy(() => import("../pages/tutor/TutorProfile").then((m) => ({ default: m.TutorProfile })));
const TutorSessionDetail = lazy(() => import("../pages/tutor/TutorSessionDetail").then((m) => ({ default: m.TutorSessionDetail })));
const TutorSessions = lazy(() => import("../pages/tutor/TutorSessions").then((m) => ({ default: m.TutorSessions })));
const TutorStudents = lazy(() => import("../pages/tutor/TutorStudents").then((m) => ({ default: m.TutorStudents })));

import App from "./App";
import { AuthPage } from "../pages/shared/AuthPage";
import { NotFoundPage } from "../pages/shared/NotFoundPage";
import BlogsPage from "../pages/BlogsPage";
import BlogPage from "../pages/BlogPage";


// import { CounselorStudentDetail } from "../pages/counselor/CounselorStudentDetail";
import { CounselorCalendar } from "@/pages/counselor/CounselorCalendar";
import { CounselorSessions } from "@/pages/counselor/CounselorSessions";
import { CounselorSessionDetail } from "@/pages/counselor/CounselorSessionDetail";

// Three billing designs to compare. Keep one, delete the rest.
// Two ways to buy a month of lessons, to compare. Keep one.

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { homePathForRole, requiresApproval } from "../utils/roleRoutes";
import { DEV_PREVIEW } from "../config/dev";
import { BreadcrumbProvider } from "../contexts/BreadcrumbContext";
import { TopbarActionsProvider } from "../contexts/TopbarActionsContext";
// Eager, unlike every other page here. A failed chunk download is one of the
// things this screen exists to explain, and it cannot explain it if showing it
// needs another chunk download.
import { ErrorPage, AppErrorBoundary } from "../pages/shared/ErrorPage";

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
    // The developer console. Its own route so no dev affordance ever appears
    // inside real product screens.
    { path: "/dev", element: <DevConsole /> },
    { path: "/preview/onboarding/:role", element: <OnboardingPreview /> },
    { path: "/preview/pending/:role/:status?", element: <PendingPreview /> },
    // The catalog is public data and reads fine with no session, so this is the
    // fastest way to iterate on the layout without seeding a demo student.
    { path: "/preview/explore", element: <StudentExploreUniversities /> },
    { path: "/preview/college-list", element: <StudentCollegeList /> },
    { path: "/preview/college-rows", element: <CollegeListPreview /> },
    { path: "/preview/tracker", element: <TrackerPreview /> },
  ]
  : [];

function AppRootLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  return (
    <>
      <Toaster
        position={isAdmin ? "bottom-right" : "top-center"}
        richColors
        toastOptions={{
          classNames: {
            success: '!bg-[#1099A1aa] !border-none !text-white',
            warning: '!bg-[#CAA25F] !border-none !text-white',
            error: '!bg-[#ef4444] !border-none !text-white'
          }
        }}
      />
      <Outlet />
      {/* Here rather than on one page: it should be offerable to a visitor
          reading the landing page and to somebody already signed in, and it
          hides itself once the app is installed. */}
      <InstallPrompt />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <AppRootLayout />,
    // On the root, so every route inherits it. Set per route it was missing
    // from most of them, and a page without one falls through to React
    // Router's built-in developer screen: a raw stack trace, addressed to
    // whoever wrote the app rather than to whoever is reading it.
    errorElement: <ErrorPage />,
    children: [
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
    path: "/posts",
    element: <BlogsPage />,
  },
  {
    path: "/post/:id",
    element: <BlogPage />,
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
          { path: "applicants", element: <AdminApplicants /> },
          { path: "reports", element: <AdminReports /> },
          { path: "courses", element: <AdminCourses /> },
          { path: "courses/:id", element: <AdminCourseDetail /> },
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
          { path: "students/:id", element: <CounselorStudents /> },
          { path: "messages", element: <CounselorMessages /> },
          { path: "notifications", element: <CounselorNotifications /> },
          { path: "calendar", element: <CounselorCalendar /> },
          { path: "sessions", element: <CounselorSessions /> },
          { path: "essays", element: <CounselorEssays /> },
          { path: "earnings", element: <CounselorEarnings /> },
          { path: "profile", element: <CounselorProfile /> },
          { path: "roadmap", element: <StudentRoadmap /> },
          { path: "explore", element: <CounselorExplore /> },
          { path: "meeting/:id", element: <CounselorSessionDetail /> },
          { path: "session/:id", element: <CounselorSessionDetail /> },
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
          { path: "find-courses", element: <TutorCourseCatalog /> },
          { path: "courses/:id", element: <TutorCourses /> },
          { path: "earnings", element: <TutorEarnings /> },
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
          { path: "college-list", element: <Navigate to="/parent/children" replace /> },
          { path: "explore", element: <ParentExplore /> },
          { path: "child-chats", element: <ParentChildChats /> },
          { path: "billing", element: <ParentBilling /> },
          { path: "admissions", element: <ParentAdmissions /> },
          { path: "billing-1", element: <Billing1 /> },
          { path: "billing-2", element: <Billing2 /> },
          { path: "billing-4", element: <Billing4 /> },
          { path: "courses-v1", element: <BookingV1 /> },
          { path: "courses-v1/:courseId", element: <BookingV1 /> },
          { path: "courses-v2", element: <BookingV2 /> },
          { path: "courses-v2/:courseId", element: <BookingV2 /> },
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
          { path: "my-learning", element: <StudentCourseDashboard /> },
          {
            path: "my-learning/:courseId",
            element: <StudentCourseDashboard />,
            children: [
              { index: true, element: <Navigate to="tasks" replace /> },
              { path: "tasks", element: <StudentCourseTasks /> },
              { path: "sessions", element: <StudentCourseSessions /> },
              { path: "messages", element: <StudentCourseMessages /> },
            ]
          },
          { path: "session/:id", element: <StudentSessionDetail /> },
          { path: "messages", element: <StudentMessages /> },
          { path: "roadmap", element: <StudentRoadmap /> },
          { path: "diagnostics", element: <StudentDiagnostics /> },
          { path: "explore", element: <StudentExploreUniversities /> },
          { path: "college-list", element: <StudentCollegeList /> },
          { path: "my-app", element: <StudentApplicationTracker /> },
          { path: "sessions", element: <StudentSessions /> },
          { path: "courses/:courseId", element: <StudentCourseCatalogDetail /> },
          { path: "profile", element: <StudentProfile /> },
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
    element: <NotFoundPage />
  }
  ]
  }
]);

/** Deliberately quiet: a spinner mid-navigation should not read as an error. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="animate-spin text-[#1099A1]" size={22} />
    </div>
  );
}

export function AppRouter() {
  return (
    // Outside the providers as well as the router. A context provider that
    // throws while initialising takes the whole tree with it, and the route
    // level errorElement is not mounted yet to catch it.
    <AppErrorBoundary>
      <AuthProvider>
        <BreadcrumbProvider>
          <TopbarActionsProvider>
            {/* One boundary around the whole router rather than one per route.
                A page's chunk is fetched the first time it is visited, and on a
                slow connection that gap has to look like the app working rather
                than a blank flash. */}
            <Suspense fallback={<RouteFallback />}>
              <RouterProvider router={router} />
            </Suspense>
          </TopbarActionsProvider>
        </BreadcrumbProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
