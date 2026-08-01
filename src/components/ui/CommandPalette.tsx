import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Compass, CornerDownLeft, Moon, LogOut, Search, Sun, Zap } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { currentTheme, subscribeToTheme, toggleTheme } from "@/lib/theme";
import { markAllNotificationsRead } from "@/services/notificationService";
import { cn } from "@/utils/cn";

// ============================================================
// Ctrl+K.
//
// One list. Someone typing "dark" does not know or care whether that is a page
// or a switch, and a tab in the way means typing the right word and being told
// there are no results.
//
// Navigation is built from the same nav the sidebar draws, so nothing here can
// point somewhere this role cannot reach. Every action is one that exists;
// none of them are placeholders.
// ============================================================

export interface PaletteNavItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
  children?: PaletteNavItem[];
}

interface Entry {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

/**
 * What a page is for, in a few words.
 *
 * A subtitle only earns its line if it says something the title does not, so
 * anything without an entry here falls back to its route, which at least tells
 * you where you are about to land.
 */
const PAGE_HINTS: Record<string, string> = {
  Home: "Your dashboard",
  Students: "Everyone you teach, and their records",
  Advisees: "Everyone you advise, and their records",
  Sessions: "Booked, past, and what needs confirming",
  Calendar: "Your week at a glance",
  "My Courses": "Courses you teach",
  "Find Courses": "Apply to teach something new",
  Courses: "Browse and manage courses",
  Assignments: "Set work, and mark what comes back",
  Notifications: "Everything addressed to you",
  Messages: "Conversations with families and staff",
  Earnings: "What you have earned, and what has been paid",
  Billing: "Payment methods, history, and plans",
  "My Children": "Each child, and how they are getting on",
  "My Learning": "Your courses, work, and sessions",
  Roadmap: "The path to application season",
  "College List": "Schools being considered",
  Essays: "Drafts out for review",
  Explore: "Search for schools",
  Documents: "Transcripts, scores, and letters",
  Reports: "Flagged conversations awaiting review",
  Diagnostics: "Placement and progress tests",
};

export function CommandPalette({
  navItems,
  onClose,
}: {
  navItems: PaletteNavItem[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [theme, setTheme] = useState(currentTheme);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeToTheme(setTheme), []);

  const navigation: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    const add = (item: PaletteNavItem, parent?: string) => {
      out.push({
        id: item.href,
        label: item.name,
        hint: PAGE_HINTS[item.name] ?? (parent ? `Under ${parent}` : item.href),
        icon: item.icon ?? <Compass size={18} />,
        run: () => navigate(item.href),
      });
      for (const child of item.children ?? []) add(child, item.name);
    };
    for (const item of navItems) add(item);
    return out;
  }, [navItems, navigate]);

  const actions: Entry[] = useMemo(
    () => [
      {
        id: "theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        hint: "Changes how the whole app looks",
        icon: theme === "dark" ? <Sun size={18} /> : <Moon size={18} />,
        run: () => {
          const next = toggleTheme();
          if (user?.id) {
            void import("@/lib/supabase").then(({ supabase }) =>
              supabase.from("profiles").update({ theme: next }).eq("id", user.id)
            );
          }
        },
      },
      {
        id: "read-all",
        label: "Mark all notifications read",
        hint: "Clears the badge without opening each one",
        icon: <Zap size={18} />,
        run: async () => {
          if (!user?.id) return;
          await markAllNotificationsRead(user.id);
          void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      },
      {
        id: "sign-out",
        label: "Sign out",
        hint: "End this session on this device",
        icon: <LogOut size={18} />,
        run: () => void signOut(),
      },
    ],
    [theme, user?.id, queryClient, signOut]
  );

  // Pages first because that is what most people came for, actions after
  // because there are few of them and they are easier to name exactly.
  const results = useMemo(() => {
    const pool = [...navigation, ...actions];
    const needle = query.trim().toLowerCase();
    if (!needle) return pool;
    return pool.filter(
      (e) => e.label.toLowerCase().includes(needle) || e.hint.toLowerCase().includes(needle)
    );
  }, [query, navigation, actions]);

  useEffect(() => setIndex(0), [query]);

  // Arrowing past the fold has to bring the row with it, or the highlight
  // disappears and the keyboard stops feeling connected to anything.
  useEffect(() => {
    listRef.current?.querySelectorAll("[data-row]")[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[index]);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/80 px-4 pt-[10vh] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Search size={20} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions, or resources..."
            className="flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Esc
          </button>
        </div>

        {results.length === 0 ? (
          <p className="px-5 py-14 text-center text-[14px] text-muted-foreground">
            Nothing matches that.
          </p>
        ) : (
          <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
            {results.map((entry, i) => {
              const selected = i === index;
              return (
                <button
                  key={entry.id}
                  data-row
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(entry)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-[#1099A1]/10" : "hover:bg-muted/50"
                  )}
                >
                  <span className={cn("shrink-0", selected ? "text-[#1099A1]" : "text-muted-foreground")}>
                    {entry.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[14.5px] font-medium",
                        selected ? "text-[#1099A1]" : "text-foreground"
                      )}
                    >
                      {entry.label}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {entry.hint}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex shrink-0 items-center rounded-md border border-[#1099A1]/40 px-1.5 py-1 text-[#1099A1]">
                      <CornerDownLeft size={13} />
                    </span>
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground/50" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Key>&uarr;</Key>
            <Key>&darr;</Key>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Key>Enter</Key>
            to select
          </span>
        </div>
      </div>
    </div>
  );
}


function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}
