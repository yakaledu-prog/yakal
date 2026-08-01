import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/utils/cn";

// ============================================================
// Light or dark.
//
// The class on <html> is the source of truth, because that is what Tailwind
// reads and what AuthContext sets on sign in. This mirrors it rather than
// keeping a second copy that could disagree, and saves the choice to the
// profile so it survives the next sign in on another machine.
//
// Saving is fire and forget. A theme that flips instantly and fails to persist
// is a smaller problem than one that waits on a round trip before moving.
// ============================================================

export function ThemeToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  // AuthContext applies the saved theme after the profile loads, which happens
  // after this mounts. Without watching for it the icon would show the wrong
  // half of the pair until something else re-rendered.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = document.documentElement.classList.toggle("dark");
    setIsDark(next);
    if (user?.id) {
      void supabase
        .from("profiles")
        .update({ theme: next ? "dark" : "light" })
        .eq("id", user.id);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
        className
      )}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
