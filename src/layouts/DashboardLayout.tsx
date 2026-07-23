import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  Search,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Menu,
  FlameIcon,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useBreadcrumbLabels } from "../contexts/BreadcrumbContext";
import logoImg from "@/assets/images/logo.webp";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  isLocked?: boolean;
}

interface DashboardLayoutProps {
  navItems: NavItem[];
  basePath: string;
}

export function DashboardLayout({ navItems, basePath }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [demoUnlocked, setDemoUnlocked] = useState<string[]>([]);
  const location = useLocation();
  const { profile, user } = useAuth();
  const bcLabels = useBreadcrumbLabels();

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

  const lockedItem = navItems.find(item => {
    if (demoUnlocked.includes(item.href)) return false;
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
        type: "system",
        title: "Feature Unlock Request",
        message: `${profile.full_name} has requested access to ${lockedItem.name}.`,
        link: "/parent/children"
      });

      if (notifError) throw notifError;
      toast.success("Request sent to your parent successfully!", { id: "request-access" });
      
      // DEMO: Auto-unlock after 1.5 seconds
      setTimeout(() => {
        toast.success(`${lockedItem.name} has been unlocked for this demo!`, { id: "demo-unlock", duration: 4000 });
        setDemoUnlocked(prev => [...prev, lockedItem.href]);
      }, 1500);
      
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
          {navItems.map((item) => {
            const isActive = item.href === basePath
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href);
            const isItemLocked = item.isLocked && !demoUnlocked.includes(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                  isItemLocked && "opacity-60",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  !sidebarOpen && "justify-center px-0"
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                <div className="relative flex items-center justify-center">
                  {item.icon}
                  {isItemLocked && !sidebarOpen && (
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                      <Lock size={10} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                {sidebarOpen && (
                  <>
                    <span className="font-medium text-sm flex-1">{item.name}</span>
                    {isItemLocked ? (
                      <Lock size={14} className="text-muted-foreground ml-auto opacity-70" />
                    ) : item.badge !== undefined && item.badge > 0 ? (
                      <span className="bg-[#1099A1] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ml-auto">
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile Card */}
        <div className="p-2 border-t dark:border-[#2a3942]">
          <Link to={`/${profile?.role || 'student'}/profile`} className={cn("flex items-center gap-3 w-full p-4 rounded-lg hover:bg-[#f7f7f7] dark:hover:bg-[#2a394277] transition-colors", !sidebarOpen && "justify-center")}>
            <img src={profile?.avatar_url || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} alt="Profile" className="h-10 w-10 shrink-0 rounded-full bg-background ring-2 ring-background shadow-sm object-cover" />
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

                return items.map((item, index, array) => {
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
            {/* Global Search Mock */}
            {/* <div
              className="relative hidden md:flex items-center w-80 cursor-pointer group"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <input
                type="text"
                readOnly
                placeholder="Search Yakal... (Ctrl+K)"
                className="w-full bg-muted/50 rounded-full pl-10 pr-4 py-1.5 text-sm text-muted-foreground border border-transparent group-hover:border-primary/20 transition-all cursor-pointer focus:outline-none"
              />
            </div> */}

            {/* <button className="flex relative text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-accent transition-colors"> */}
            <button className="flex relative text-muted-foreground">
              <FlameIcon className="text-[#1099A1] dark:text-[#97CE9D]" size={20} />
              {/* <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" /> */}
              {/* TODO: add real streak value here */}
              <span className="text-[#1099A1] dark:text-[#97CE9D] inline font-semibold"> &nbsp;5</span> &nbsp;days
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="relative flex-1 overflow-hidden flex flex-col dark:bg-[#111b21]">
          {/* Always render the Outlet so it's visible behind the overlay */}
          <div className={cn("flex-1 overflow-hidden flex flex-col h-full", lockedItem && "pointer-events-none blur-sm opacity-50 select-none")}>
            <Outlet context={{ sidebarOpen }} />
          </div>

          {lockedItem && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/20 dark:bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-300">
              <div className="max-w-md w-full bg-white dark:bg-[#202c33] p-8 rounded-2xl shadow-xl border border-[#e9edef] dark:border-[#2a3942] text-center pointer-events-auto">
                <div className="w-16 h-16 bg-[#1099A1]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#1099A1]">
                  <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-[#111] dark:text-white mb-3">{lockedItem.name} is Locked</h2>
                <p className="text-[#54656f] dark:text-[#aebac1] mb-8 leading-relaxed">
                  You don't have an active subscription for this service. Ask your parent to unlock {lockedItem.name} to gain access!
                </p>
                <button 
                  onClick={handleRequestAccess}
                  className="bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-80 px-6 py-3 rounded-xl font-bold transition-all w-full"
                >
                  Request Access from Parent
                </button>
              </div>
            </div>
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
