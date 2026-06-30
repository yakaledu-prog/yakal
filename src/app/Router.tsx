import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { AuthPage } from "../pages/shared/AuthPage";
import { EmailConfirmationPage } from "../pages/shared/EmailConfirmationPage";
import { OnboardingPage } from "../pages/shared/OnboardingPage";
import { NotFoundPage } from "../pages/shared/NotFoundPage";
import { ErrorPage } from "../pages/shared/ErrorPage";
import { SettingsPage } from "../pages/shared/SettingsPage";
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

import { TutorLayout } from "../pages/tutor/TutorLayout";
import { TutorHome } from "../pages/tutor/TutorHome";
import { TutorCalendar } from "../pages/tutor/TutorCalendar";
import { TutorMyLearning } from "../pages/tutor/TutorMyLearning";
import { TutorCourseTasks } from "../pages/tutor/TutorCourseTasks";
import { TutorCourseDashboard } from "../pages/tutor/TutorCourseDashboard";
import { TutorCourseOverview } from "../pages/tutor/TutorCourseOverview";
import { TutorCourseSessions } from "../pages/tutor/TutorCourseSessions";
import { TutorCourseResources } from "../pages/tutor/TutorCourseResources";
import { TutorCourses } from "../pages/tutor/TutorCourses";
import { TutorCourseCatalogDetail } from "../pages/tutor/TutorCourseCatalogDetail";
import { TutorSessions } from "../pages/tutor/TutorSessions";
import { TutorResources } from "../pages/tutor/TutorResources";
import { TutorNotifications } from "../pages/tutor/TutorNotifications";
import { TutorMessages } from "../pages/tutor/TutorMessages";
import { TutorSessionDetail } from "../pages/tutor/TutorSessionDetail";
import { TutorProfile } from "../pages/tutor/TutorProfile";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If profile is loaded but not onboarded, and we aren't already on the onboarding page, redirect to /onboarding
  if (profile && !profile.is_onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If profile is onboarded, and we are trying to access /onboarding, redirect to dashboard
  if (profile && profile.is_onboarded && location.pathname === '/onboarding') {
    return <Navigate to={`/${profile.role || 'student'}`} replace />;
  }
  
  return <Outlet />;
}

const router = createBrowserRouter([
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
        path: "admin/*",
        element: <div>Admin Dashboard (Placeholder)</div>,
      },
      {
        path: "tutor",
        element: <TutorLayout />,
        children: [
          { path: "", element: <TutorHome /> },
          { path: "calendar", element: <TutorCalendar /> },
          { path: "my-learning", element: <TutorMyLearning /> },
          { 
            path: "my-learning/:courseId", 
            element: <TutorCourseDashboard />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: "overview", element: <TutorCourseOverview /> },
              { path: "tasks", element: <TutorCourseTasks /> },
              { path: "sessions", element: <TutorCourseSessions /> },
              { path: "resources", element: <TutorCourseResources /> },
            ]
          },
          { path: "session/:id", element: <TutorSessionDetail /> },
          { path: "messages", element: <TutorMessages /> },
          { path: "sessions", element: <TutorSessions /> },
          { path: "courses", element: <TutorCourses /> },
          { path: "courses/:courseId", element: <TutorCourseCatalogDetail /> },
          { path: "resources", element: <TutorResources /> },
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
      <Toaster position="top-center" />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
