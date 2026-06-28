import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { AuthPage } from "../pages/shared/AuthPage";
import { EmailConfirmationPage } from "../pages/shared/EmailConfirmationPage";
import { OnboardingPage } from "../pages/shared/OnboardingPage";
import { NotFoundPage } from "../pages/shared/NotFoundPage";
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
        path: "tutor/*",
        element: <div>Tutor Dashboard (Placeholder)</div>,
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
