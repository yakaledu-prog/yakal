import { useState, useEffect, useRef } from "react";
import HomePage from "@/pages/HomePage";
import SubjectPage from "@/pages/SubjectPage";
import type { Page } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { hasStoredSession } from "@/lib/supabase";
import { Navigate } from "react-router-dom";

export default function App() {
  const [page, setPage] = useState<Page>({ type: "home" });
  const savedScrollY = useRef(0);
  const { user, profile, loading } = useAuth();

  // Restore scroll position when returning home
  useEffect(() => {
    if (page.type === "home") {
      if (window.location.hash) return; // Let HomePage handle hash scrolling
      const target = page.scrollY ?? 0;
      // small delay to let render complete
      requestAnimationFrame(() => {
        window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [page]);

  // Somebody signed in should never see the landing page, even for a frame.
  //
  // While auth resolves this fell through and rendered the whole marketing page,
  // then replaced it the moment the profile arrived: navigations went / -> / ->
  // /student, and the flash was visible on every visit to the root.
  //
  // sessionStorage answers "is there a token here" synchronously, so a returning
  // tab waits on a blank ground for the real answer instead of being shown a
  // page it is about to lose. A visitor with no token is not made to wait: the
  // landing page is what they came for and it renders immediately.
  if (loading && hasStoredSession()) {
    return <div className="min-h-screen bg-background" />;
  }

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
