import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { AuthPage } from "../pages/shared/AuthPage";
import { NotFoundPage } from "../pages/shared/NotFoundPage";
import { StudentLayout } from "../pages/student/StudentLayout";
import { StudentHome } from "../pages/student/StudentHome";
import { StudentCalendar } from "../pages/student/StudentCalendar";
import { StudentTasks } from "../pages/student/StudentTasks";
import { StudentCourses } from "../pages/student/StudentCourses";
import { StudentSessions } from "../pages/student/StudentSessions";
import { StudentResources } from "../pages/student/StudentResources";
import { StudentNotifications } from "../pages/student/StudentNotifications";
import { StudentMessages } from "../pages/student/StudentMessages";
import { StudentSessionDetail } from "../pages/student/StudentSessionDetail";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // The original state-based app handles the landing page and blogs
  },
  {
    path: "/login",
    element: <AuthPage />,
  },
  {
    path: "/admin/*",
    element: <div>Admin Dashboard (Placeholder)</div>,
  },
  {
    path: "/tutor/*",
    element: <div>Tutor Dashboard (Placeholder)</div>,
  },
  {
    path: "/student",
    element: <StudentLayout />,
    children: [
      { path: "", element: <StudentHome /> },
      { path: "calendar", element: <StudentCalendar /> },
      { path: "tasks", element: <StudentTasks /> },
      { path: "session/:id", element: <StudentSessionDetail /> },
      { path: "messages", element: <StudentMessages /> },
      { path: "sessions", element: <StudentSessions /> },
      { path: "courses", element: <StudentCourses /> },
      { path: "resources", element: <StudentResources /> },
      { path: "notifications", element: <StudentNotifications /> },
      { path: "*", element: <NotFoundPage /> },
    ]
  },
  {
    path: "/parent/*",
    element: <div>Parent Dashboard (Placeholder)</div>,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
