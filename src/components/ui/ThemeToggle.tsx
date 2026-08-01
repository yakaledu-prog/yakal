import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { currentTheme, subscribeToTheme, toggleTheme } from "@/lib/theme";
import { cn } from "@/utils/cn";

// ============================================================
// Light or dark.
//
// The choice itself lives in lib/theme, which owns the class on <html> and the
// browser's memory of it. This is only the button: it flips, subscribes so the
// icon stays honest if something else flips it, and saves to the profile so
// the choice follows the person to another machine.
//
// Saving is fire and forget. A theme that changes instantly and fails to sync
// is a smaller problem than one that waits on the network before moving.
// ============================================================

export function ThemeToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => subscribeToTheme(setTheme), []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const next = toggleTheme();
        if (user?.id) {
          void supabase.from("profiles").update({ theme: next }).eq("id", user.id);
        }
      }}
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
