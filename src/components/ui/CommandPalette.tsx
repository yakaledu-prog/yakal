import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Compass,
  CornerDownLeft,
  Link as LinkIcon,
  LogOut,
  Moon,
  PanelLeft,
  RefreshCw,
  Search,
  Sun,
  UserRound,
  Zap,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { currentTheme, subscribeToTheme, toggleTheme } from "@/lib/theme";
import { markAllNotificationsRead } from "@/services/notificationService";
import { cn } from "@/utils/cn";

// ============================================================
// Ctrl+K.
//
// Places to go and things to do, grouped so a long list stays readable, but
// searched together whichever group is showing. A filter that has to be
// clicked before it will find something answers a correct search with nothing,
// so the chips narrow results rather than deciding what is looked at.
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
  onToggleSidebar,
  onClose,
}: {
  navItems: PaletteNavItem[];
  onToggleSidebar?: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, signOut } = useAuth();

  // "all" until somebody narrows it. The chips are a filter on the answer, not
  // a question you have to get right before asking.
  const [filter, setFilter] = useState<"all" | "navigation" | "actions">("all");
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
        id: "profile",
        label: "Open your profile",
        hint: "Your details, photo, and preferences",
        icon: <UserRound size={18} />,
        run: () => navigate(`/${profile?.role ?? "student"}/profile`),
      },
      {
        id: "sidebar",
        label: "Collapse or expand the sidebar",
        hint: "More room for the page, or more room for the nav",
        icon: <PanelLeft size={18} />,
        run: () => onToggleSidebar?.(),
      },
      {
        id: "refresh",
        label: "Reload everything",
        hint: "Fetch fresh data from the server",
        icon: <RefreshCw size={18} />,
        run: () => void queryClient.invalidateQueries(),
      },
      {
        id: "copy-link",
        label: "Copy a link to this page",
        hint: "Puts the current address on your clipboard",
        icon: <LinkIcon size={18} />,
        run: () => void navigator.clipboard?.writeText(window.location.href),
      },
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
    [theme, user?.id, profile?.role, queryClient, signOut, navigate, onToggleSidebar]
  );

  // Matches per group, whatever the chips say. The counts on the chips come
  // from here too, so narrowing never hides a match without saying how many.
  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const hits = (pool: Entry[]) =>
      needle
        ? pool.filter(
          (e) =>
            e.label.toLowerCase().includes(needle) || e.hint.toLowerCase().includes(needle)
        )
        : pool;
    return { navigation: hits(navigation), actions: hits(actions) };
  }, [query, navigation, actions]);

  // Pages first because that is what most people came for, actions after
  // because there are few of them and easier to name exactly.
  const groups = useMemo(() => {
    const out: { label: string; entries: Entry[] }[] = [];
    if (filter !== "actions" && matched.navigation.length > 0) {
      out.push({ label: "Navigation", entries: matched.navigation });
    }
    if (filter !== "navigation" && matched.actions.length > 0) {
      out.push({ label: "Quick Actions", entries: matched.actions });
    }
    return out;
  }, [filter, matched]);

  const results = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  useEffect(() => setIndex(0), [query, filter]);

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
    } else if (e.key === "Tab") {
      e.preventDefault();
      setFilter((f) => (f === "all" ? "navigation" : f === "navigation" ? "actions" : "all"));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[index]);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/80 px-4 pt-[10vh] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 border-b-0 border-border px-5 py-4">
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
            className="hidden md:flex lg:flex shrink-0 rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Esc
          </button>
        </div>

        <div className="hidden md:flex lg:flex items-center gap-2 border-b border-border/35 px-2 py-3">
          <Chip
            active={filter === "navigation"}
            onClick={() => setFilter((f) => (f === "navigation" ? "all" : "navigation"))}
            icon={<Compass size={14} />}
            label="Navigation"
            count={matched.navigation.length}
          />
          <Chip
            active={filter === "actions"}
            onClick={() => setFilter((f) => (f === "actions" ? "all" : "actions"))}
            icon={<Zap size={14} />}
            label="Quick Actions"
            count={matched.actions.length}
          />
        </div>

        {results.length === 0 ? (
          <p className="px-5 py-14 text-center text-[14px] text-muted-foreground">
            Nothing matches that.
          </p>
        ) : (
          <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
            {groups.map((group) => (
              <div key={group.label}>
                {/* The heading is dropped when only one group is showing: it
                    would be labelling the whole list after the chip above
                    already said so. */}
                {/* {groups.length > 1 && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )} */}
                {group.entries.map((entry) => {
                  const i = results.indexOf(entry);
                  const selected = i === index;
                  return (
                    <button
                      key={entry.id}
                      data-row
                      type="button"
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => choose(entry)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-colors",
                        selected ? "bg-[#1099A1]/10" : "hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn("shrink-0", selected ? "text-[#1099A1]" : "text-muted-foreground")}
                      >
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
                        {/* <span className="block truncate text-[12.5px] text-muted-foreground">
                          {entry.hint}
                        </span> */}
                      </span>
                      {selected ? (
                        <span className="hidden md:flex lg:flex shrink-0 items-center rounded-md border border-[#1099A1]/40 px-1.5 py-1 text-[#1099A1]">
                          <CornerDownLeft size={13} />
                        </span>
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-muted-foreground/50" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="capitalize hidden md:flex lg:flex items-center justify-between gap-4 border-t border-border/35 px-5 py-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Key>&uarr;</Key>
            <Key>&darr;</Key>
            navigate
            <span className="px-1">&middot;</span>
            <Key>Tab</Key>
            filter
          </span>
          <span className="flex items-center gap-1.5">
            <Key>Enter</Key>
            select
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

function Chip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[#1099A1]/10 text-[#1099A1]"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        count === 0 && "opacity-40"
      )}
    >
      {icon}
      {label}
      {/* The count is what tells you the other group has matches too, so
          narrowing is a choice rather than a discovery. */}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}
