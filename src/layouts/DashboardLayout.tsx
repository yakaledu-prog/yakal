import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { 
  Bell, 
  Search, 
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Menu
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  navItems: NavItem[];
  basePath: string;
}

export function DashboardLayout({ navItems, basePath }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

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
          "fixed inset-y-0 left-0 z-50 md:relative md:flex flex-col transition-all duration-300 bg-card border-r",
          sidebarOpen ? "w-60 translate-x-0" : "w-60 -translate-x-full md:w-20 md:translate-x-0"
        )}
      >
        <div className={cn("h-16 flex items-center px-4", sidebarOpen ? "justify-between" : "justify-center")}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <img src="/src/assets/images/logo.webp" alt="Yakal" className="h-10 object-contain" />
              </div>
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
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  !sidebarOpen && "justify-center px-0"
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                {item.icon}
                {sidebarOpen && <span className="font-medium text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t">
          {/* Profile Card */}
          <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center")}>
            <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="h-10 w-10 shrink-0 rounded-full bg-background ring-2 ring-background shadow-sm" />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">Demo User</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">Student</p>
                  <button onClick={() => document.documentElement.classList.toggle("dark")} className="text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted p-1">
                    <Moon size={12} className="hidden dark:block" />
                    <Sun size={12} className="block dark:hidden" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
              <span className="capitalize">{basePath.replace('/', '')}</span>
              <ChevronRight size={14} />
              <span className="text-foreground font-medium capitalize">
                {location.pathname.split('/').pop() || 'Home'}
              </span>
            </div>
            
            {/* Streak & Info */}
            <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-amber-500 text-lg leading-none">🔥</span>
                <span>4 Day Streak</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-emerald-500 font-bold">A-</span>
                <span className="text-muted-foreground">Avg</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Global Search Mock */}
            <div 
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
            </div>

            <button className="relative text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-accent transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Outlet context={{ sidebarOpen }} />
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
