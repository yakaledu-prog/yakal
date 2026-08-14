import { useState, useEffect, useRef } from "react";
import HomePage from "@/pages/HomePage";
import SubjectPage from "@/pages/SubjectPage";
import type { Page } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { FullPageLoader } from "@/components/ui/FullPageLoader";

/**
 * Whether a session is likely to resolve, answered synchronously.
 *
 * Supabase keeps its token in sessionStorage under sb-<ref>-auth-token. Auth
 * resolves asynchronously, so without this check there are only two options
 * and both are wrong: paint the landing page and let a signed-in user watch it
 * get replaced by their dashboard, or hold every first-time visitor behind a
 * loading screen on a marketing page.
 *
 * Reading the key costs nothing and separates the two cases. A visitor gets
 * the landing page immediately; somebody with a session waits a moment and
 * lands where they belong.
 */
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // Private mode. Fall through to the landing page, which is the safe half:
    // the worst case is the flash this exists to remove.
  }
  return false;
}

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

  // Held back only for somebody who is probably signed in.
  if (loading && hasStoredSession()) return <FullPageLoader />;

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
