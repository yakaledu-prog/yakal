import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { LockedOverlay } from "@/components/shared/LockedOverlay";
import {
  Search,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Menu,
  FlameIcon,
  Lock,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useBreadcrumbLabels } from "../contexts/BreadcrumbContext";
import { useTopbarActionsContext } from "../contexts/TopbarActionsContext";
import logoImg from "@/assets/images/logo.webp";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  isLocked?: boolean;
  /** The service that unlocks this item, named in the unlock request. */
  lockedBy?: string;
  /** Renders this item as a collapsible group instead of a link. */
  children?: NavItem[];
}

/** Groups are containers, so route matching only ever runs against leaves. */
function flattenNav(items: NavItem[]): NavItem[] {
  return items.flatMap((i) => (i.children?.length ? i.children : [i]));
}

interface DashboardLayoutProps {
  navItems: NavItem[];
  basePath: string;
}

export function DashboardLayout({ navItems, basePath }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { profile, user } = useAuth();
  const bcLabels = useBreadcrumbLabels();
  const { actions: topbarActions } = useTopbarActionsContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Locked state comes from the data now. It used to be overridden by a local
  // list that a 500ms timer wrote to, so anything "unlocked" itself moments
  // after the request and nothing was ever really gated.
  const lockedItem = flattenNav(navItems).find(item => {
    if (item.href === basePath) return location.pathname === item.href && item.isLocked;
    return location.pathname.startsWith(item.href) && item.isLocked;
  });

  const handleRequestAccess = async () => {
    if (!user || !profile || !lockedItem) return;

    toast.loading("Sending request...", { id: "request-access" });
    try {
      const { data: linkData, error: linkError } = await supabase
        .from("parent_student_links")
        .select("parent_id")
        .eq("student_id", user.id)
        .single();

      if (linkError || !linkData?.parent_id) {
        throw new Error("No linked parent account found.");
      }

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: linkData.parent_id,
        // The type and link carry enough for the parent screen to offer a
        // one-click grant rather than sending them off to find the setting.
        type: "unlock_request",
        title: "Feature unlock request",
        message: `${profile.full_name} has asked for access to ${lockedItem.name}.`,
        link: `/parent/children?student=${user.id}&service=${lockedItem.lockedBy ?? "admissions"}`,
      });

      if (notifError) throw notifError;
      toast.success("Request sent. Your parent can turn it on from their account.", {
        id: "request-access",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to send request.", { id: "request-access" });
    }
  };

  return (
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:relative md:flex flex-col transition-all duration-300 bg-card dark:bg-[#111b21] border-r dark:border-[#2a3942]",
          sidebarOpen ? "w-60 translate-x-0" : "w-60 -translate-x-full md:w-20 md:translate-x-0"
        )}
      >
        <div className={cn("h-16 flex items-center px-4", sidebarOpen ? "justify-between" : "justify-center")}>
          {sidebarOpen ? (
            <>
              <Link to="/" className="flex items-center gap-2">
                <img src={logoImg} alt="Yakal" className="h-10 object-contain" />
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="hidden md:flex text-muted-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
              >
                <PanelLeftClose size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex text-muted-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
            >
              <PanelLeft size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {navItems.map((item) =>
            item.children?.length ? (
              <NavGroup
                key={item.name}
                item={item}
                sidebarOpen={sidebarOpen}
                basePath={basePath}
                pathname={location.pathname}
              />
            ) : (
              <NavLeaf
                key={item.href}
                item={item}
                sidebarOpen={sidebarOpen}
                basePath={basePath}
                pathname={location.pathname}
              />
            )
          )}
        </nav>

        {/* Profile Card */}
        <div className="p-2 border-t dark:border-[#2a3942]">
          <Link to={`/${profile?.role || 'student'}/profile`} className={cn("flex items-center gap-3 w-full rounded-lg hover:bg-[#f7f7f7] dark:hover:bg-[#2a394277] transition-colors", sidebarOpen ? "p-4" : "p-2 justify-center")}>
            <img src={profile?.avatar_url || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} alt="Profile" className="h-10 w-10 min-w-[40px] shrink-0 rounded-full bg-background ring-2 ring-background shadow-sm object-cover" />
            {sidebarOpen && (
              <div className="flex flex-col gap-1 w-full min-w-0">
                <p className="text-sm font-semibold truncate">{profile?.full_name || user?.email || "User"}</p>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <p className="text-xs text-muted-foreground truncate capitalize min-w-0">{profile?.role || "Student"}</p>
                  <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                    <button onClick={() => document.documentElement.classList.toggle("dark")} className="text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted p-1" title="Toggle Theme">
                      <Moon size={12} className="hidden dark:block" />
                      <Sun size={12} className="block dark:hidden" />
                    </button>
                    {/* <button onClick={() => signOut()} className="text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted p-1" title="Log Out">
                      <LogOut size={12} />
                    </button> */}
                  </div>
                </div>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 bg-card dark:bg-[#111b21] border-b dark:border-[#2a3942] flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center text-sm text-muted-foreground">
              {(() => {
                const segments = location.pathname.split('/').filter(Boolean);
                const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(s);
                const items = segments.map((segment, index) => ({
                  label: bcLabels[segment]
                    ? bcLabels[segment]
                    : isUuid(segment)
                      ? 'Details'
                      : segment.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                  path: '/' + segments.slice(0, index + 1).join('/')
                }));

                if (items.length === 1) {
                  items.push({ label: 'Home', path: items[0].path });
                }

                const visibleItems = items.filter(item => item.label !== 'HIDDEN');

                return visibleItems.map((item, index, array) => {
                  const isLast = index === array.length - 1;
                  return (
                    <React.Fragment key={index}>
                      {index > 0 && <ChevronRight size={14} className="mx-1 shrink-0" />}
                      {isLast ? (
                        <span className="text-foreground font-medium truncate max-w-[150px]">
                          {item.label}
                        </span>
                      ) : (
                        <Link to={item.path} className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]">
                          {item.label}
                        </Link>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </div>

            {/* Streak & Info */}
            {/* <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-amber-500 text-lg leading-none">🔥</span>
                <span>4 Day Streak</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-emerald-500 font-bold">A-</span>
                <span className="text-muted-foreground">Avg</span>
              </div>
            </div> */}
          </div>

          <div className="flex items-center gap-4">
            {topbarActions ? (
              topbarActions
            ) : (
              <button className="flex relative text-muted-foreground">
                <FlameIcon className="text-[#1099A1] dark:text-[#97CE9D]" size={20} />
                <span className="text-[#1099A1] dark:text-[#97CE9D] inline font-semibold"> &nbsp;5</span> &nbsp;days
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="relative flex-1 overflow-hidden flex flex-col dark:bg-[#111b21]">
          {/* Always render the Outlet so it's visible behind the overlay */}
          <div className={cn("flex-1 overflow-hidden flex flex-col h-full", lockedItem && "pointer-events-none blur-sm opacity-50 select-none")}>
            <Outlet context={{ sidebarOpen }} />
          </div>

          {lockedItem && (
            <LockedOverlay
              featureName={lockedItem.name}
              onRequestAccess={handleRequestAccess}
              homePath={basePath}
            />
          )}
        </div>

        {/* Floating Search Modal */}
        {searchOpen && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4">
            <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center px-4 py-4 border-b">
                <Search className="h-5 w-5 text-muted-foreground mr-3" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-foreground outline-none text-lg"
                />
                <button onClick={() => setSearchOpen(false)} className="text-muted-foreground hover:text-foreground text-xs font-mono border rounded px-1.5 py-0.5">ESC</button>
              </div>
              <div className="p-4 text-sm text-muted-foreground text-center">
                No recent searches
              </div>
            </div>
            {/* Click outside to close */}
            <div className="absolute inset-0 -z-10" onClick={() => setSearchOpen(false)} />
          </div>
        )}
      </main>
    </div>
  );
}

// -- Sidebar items ------------------------------------------------------------

interface NavNodeProps {
  item: NavItem;
  sidebarOpen: boolean;
  basePath: string;
  pathname: string;
  /** Nested items sit under a group header and are indented. */
  nested?: boolean;
}

function matches(href: string, basePath: string, pathname: string) {
  return href === basePath ? pathname === href : pathname.startsWith(href);
}

function NavLeaf({
  item, sidebarOpen, basePath, pathname, nested = false,
}: NavNodeProps) {
  const isActive = matches(item.href, basePath, pathname);
  const isLocked = !!item.isLocked;

  return (
    <Link
      to={item.href}
      title={!sidebarOpen ? item.name : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
        isLocked && "opacity-60",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        !sidebarOpen && "justify-center px-0",
        nested && sidebarOpen && "py-2"
      )}
    >
      <div className="relative flex items-center justify-center">
        {item.icon}
        {isLocked && !sidebarOpen && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
            <Lock size={10} className="text-muted-foreground" />
          </div>
        )}
      </div>
      {sidebarOpen && (
        <>
          <span className={cn("flex-1 font-medium", nested ? "text-[13px]" : "text-sm")}>
            {item.name}
          </span>
          {isLocked ? (
            <Lock size={14} className="ml-auto text-muted-foreground opacity-70" />
          ) : item.badge !== undefined && item.badge > 0 ? (
            <span className="ml-auto min-w-[20px] rounded-full bg-[#1099A1] px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}

function NavGroup({
  item, sidebarOpen, basePath, pathname,
}: NavNodeProps) {
  const children = item.children ?? [];
  const hasActiveChild = children.some((c) => matches(c.href, basePath, pathname));

  // Open when a child route is active, and stay open once opened by hand.
  const [open, setOpen] = useState(hasActiveChild);
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  // A collapsed rail has no room for a header plus indented children, so the
  // group flattens back into plain icons rather than hiding its contents.
  if (!sidebarOpen) {
    return (
      <>
        {children.map((c) => (
          <NavLeaf
            key={c.href}
            item={c}
            sidebarOpen={sidebarOpen}
            basePath={basePath}
            pathname={pathname}
          />
        ))}
      </>
    );
  }

  const allLocked = children.every(
    (c) => c.isLocked
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
          allLocked && "opacity-60",
          hasActiveChild && !open
            ? "text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <div className="flex items-center justify-center">{item.icon}</div>
        <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
        {allLocked && <Lock size={13} className="text-muted-foreground opacity-70" />}
        <ChevronDown
          size={15}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="relative ml-[22px] mt-0.5 flex flex-col gap-0.5 pl-3">
          {/* Single rule tying the children to their header, instead of a
              border on every row. */}
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 w-px bg-[#e9edef] dark:bg-[#2a3942]"
          />
          {children.map((c) => (
            <NavLeaf
              key={c.href}
              item={c}
              sidebarOpen={sidebarOpen}
              basePath={basePath}
              pathname={pathname}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}
