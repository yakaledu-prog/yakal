// ============================================================
// Light or dark, and which one this browser remembers.
//
// The theme used to live only in the profile row, applied after sign in. That
// meant it did not survive a reload until the profile came back, and did not
// survive at all on a page where nobody was signed in: the class was set once,
// by whoever happened to load a profile, and lost on the next refresh.
//
// So the browser remembers, and the profile is where the choice travels
// between machines. Local wins for the paint, the profile wins on sign in.
// ============================================================

const KEY = "yakal-theme";

export type Theme = "light" | "dark";

/** What this browser last had, or what the operating system prefers. */
export function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private browsing can refuse storage. The system preference still works.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const listeners = new Set<(theme: Theme) => void>();

/**
 * Put the theme on <html> and remember it.
 *
 * Called before React mounts as well as from the toggle, which is what stops
 * the page flashing white on the way to being dark.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Nothing to do. The class is set, which is the part that matters now.
  }
  for (const listener of listeners) listener(theme);
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

/** For anything that renders differently per theme and has to re-render. */
export function subscribeToTheme(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
