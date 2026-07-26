import { useState, useEffect, useRef } from "react";
import HomePage from "@/pages/HomePage";
import SubjectPage from "@/pages/SubjectPage";
import type { Page } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function App() {
  const [page, setPage] = useState<Page>({ type: "home" });
  const savedScrollY = useRef(0);
  const { user, profile, loading } = useAuth();

  // Restore scroll position when returning home
  useEffect(() => {
    if (page.type === "home") {
      const target = page.scrollY ?? 0;
      // small delay to let render complete
      requestAnimationFrame(() => {
        window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [page]);

  if (!loading && user) {
    if (profile && profile.is_onboarded) {
      return <Navigate to={`/${profile.role || 'student'}`} replace />;
    } else if (profile && !profile.is_onboarded) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  function navigateTo(nextPage: Page) {
    savedScrollY.current = window.scrollY;
    window.scrollTo(0, 0);
    setPage(nextPage);
  }

  function goHome() {
    setPage({ type: "home", scrollY: savedScrollY.current });
  }

  if (page.type === "subject") {
    return <SubjectPage subject={{ name: page.name, img: page.img }} onBack={goHome} />;
  }

  return <HomePage onNavigate={navigateTo} />;
}
