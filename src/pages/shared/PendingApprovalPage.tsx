import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import {
  Clock, XCircle, LogOut, Lock, Home, Users, CalendarDays,
  MessagesSquare, ClipboardList, FileText, Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import logoImg from "@/assets/images/logo.webp";
import { dicebearUrl } from "@/utils/avatar";

interface PendingApprovalPageProps {
  preview?: boolean;
  previewRole?: string;
  previewStatus?: "pending" | "rejected";
}

const LOCKED_NAV: Record<string, { label: string; icon: React.ReactNode }[]> = {
  tutor: [
    { label: "Home", icon: <Home size={18} /> },
    { label: "Students", icon: <Users size={18} /> },
    { label: "Sessions", icon: <CalendarDays size={18} /> },
    { label: "Assignments", icon: <ClipboardList size={18} /> },
    { label: "Messages", icon: <MessagesSquare size={18} /> },
  ],
  counselor: [
    { label: "Home", icon: <Home size={18} /> },
    { label: "Applications", icon: <FileText size={18} /> },
    { label: "Messages", icon: <MessagesSquare size={18} /> },
  ],
};

export function PendingApprovalPage({
  preview = false,
  previewRole,
  previewStatus,
}: PendingApprovalPageProps) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  // Re-fetch the profile; the Router redirects to the dashboard if now approved,
  // otherwise we tell the user it's still under review.
  const handleCheckStatus = async () => {
    if (preview) return;
    setChecking(true);
    try {
      const fresh = await refreshProfile();
      if (fresh && fresh.status === "active") {
        toast.success("You're approved! Taking you to your dashboard…");
      } else if (fresh && fresh.status === "rejected") {
        toast.error("Your application was not approved.");
      } else {
        toast("Still under review, we'll notify you once it's approved.");
      }
    } finally {
      setChecking(false);
    }
  };

  const role = previewRole ?? profile?.role ?? "tutor";
  const status = previewStatus ?? profile?.status ?? "pending";
  const rejected = status === "rejected";
  const fullName = preview ? "Preview User" : profile?.full_name || "there";
  const avatar = (preview ? null : profile?.avatar_url) || dicebearUrl(fullName);
  const navItems = LOCKED_NAV[role] ?? LOCKED_NAV.tutor;

  return (
    <div className="flex h-screen bg-muted/20 dark:bg-[#111b21] overflow-hidden font-sans">
      {/* Locked sidebar (visual only) */}
      <aside className="hidden md:flex w-60 flex-col bg-card dark:bg-[#111b21] border-r dark:border-[#2a3942]">
        <div className="h-16 flex items-center px-4">
          <img src={logoImg} alt="Yakal" className="h-9 object-contain" />
        </div>
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground/50 cursor-not-allowed select-none"
              title="Available after approval"
            >
              {item.icon}
              <span className="font-medium text-sm flex-1">{item.label}</span>
              <Lock size={13} />
            </div>
          ))}
        </nav>
        <div className="p-2 border-t dark:border-[#2a3942]">
          <div className="flex items-center gap-3 w-full p-3 rounded-lg">
            <img src={avatar} alt="Profile" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-background" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                {rejected ? "Not approved" : "Pending review"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card dark:bg-[#111b21] border-b dark:border-[#2a3942] flex items-center justify-between px-4 sm:px-6">
          <span className="text-sm font-medium text-muted-foreground">Account status</span>
          <button
            onClick={() => !preview && signOut()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6 dark:bg-[#111b21]">
          <div className="w-full max-w-[440px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-sm p-8 text-center">
            <div
              className={
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 " +
                (rejected ? "bg-red-500/10" : "bg-[#1099A1]/10")
              }
            >
              {rejected ? (
                <XCircle className="text-red-500" size={30} />
              ) : (
                <Clock className="text-[#1099A1]" size={30} />
              )}
            </div>

            {rejected ? (
              <>
                <h1 className="text-[21px] font-bold text-[#111] dark:text-white mb-2">
                  Application not approved
                </h1>
                <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mb-4">
                  Unfortunately your {role} application was not approved.
                </p>
                {profile?.rejection_reason && (
                  <div className="text-left bg-[#f8f9fa] dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-4 mb-6">
                    <p className="text-[11px] font-semibold text-[#54656f] dark:text-[#aebac1] uppercase tracking-wider mb-1">
                      Reason
                    </p>
                    <p className="text-[14px] text-[#111] dark:text-white">{profile.rejection_reason}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="text-[21px] font-bold text-[#111] dark:text-white mb-2">
                  Your application is under review
                </h1>
                <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mb-6">
                  Thanks for registering as a {role}, {fullName}. An administrator is reviewing your
                  account. You'll be notified once it's approved, then your dashboard unlocks.
                </p>
              </>
            )}

            {!rejected && (
              <Button
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full h-11 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
              >
                {checking && <Loader2 size={15} className="animate-spin" />}
                {checking ? "Checking…" : "Check status"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
