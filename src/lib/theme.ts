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
  const root = document.documentElement;

  // Colour transitions off for the swap itself. Most of the app carries
  // transition-colors, so without this the background changes at once while
  // every border eases across, and for about 150ms near-white edges sit on a
  // dark page. Two frames, because one is not enough to guarantee the new
  // colours have been painted before transitions come back.
  root.classList.add("theme-switching");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
  });

  root.classList.toggle("dark", theme === "dark");
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

/**
 * Flip it, and remember the choice everywhere it is read from.
 *
 * The profile write is the half that was missing. applyTheme stored the choice
 * in this browser, but the profile row kept its old value, and fetchProfile
 * applies that row on every load rather than only on sign in. So a reload
 * handed the stale profile back and the toggle looked like it had done nothing.
 *
 * Only on a deliberate toggle, never from applyTheme: that also runs from
 * main.tsx before React mounts and before there is a session to write to.
 *
 * Fire and forget. A failed write means the choice does not follow them to
 * another machine, which is not worth failing a click over, and this browser
 * has already stored it either way.
 */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  void rememberOnProfile(next);
  return next;
}

async function rememberOnProfile(theme: Theme): Promise<void> {
  try {
    // Imported lazily: this module is loaded before React and must not drag
    // the Supabase client into that first paint.
    const { supabase } = await import("./supabase");
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await supabase.from("profiles").update({ theme }).eq("id", userId);
  } catch {
    // Signed out, offline, or storage refused. The class is set and this
    // browser remembers, which is the part that matters now.
  }
}

/** For anything that renders differently per theme and has to re-render. */
export function subscribeToTheme(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
