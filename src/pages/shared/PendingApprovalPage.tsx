import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Clock, XCircle, LogOut } from "lucide-react";
import logoImg from "@/assets/images/logo.webp";

export function PendingApprovalPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const rejected = profile?.status === "rejected";
  const roleLabel = profile?.role === "counselor" ? "counselor" : "tutor";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      <Card className="w-full max-w-[460px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl p-8 text-center">
        <img src={logoImg} alt="Yakal" className="h-10 object-contain mx-auto mb-8" />

        <div
          className={
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 " +
            (rejected ? "bg-red-500/10" : "bg-[#1099A1]/10")
          }
        >
          {rejected ? (
            <XCircle className="text-red-500" size={32} />
          ) : (
            <Clock className="text-[#1099A1]" size={32} />
          )}
        </div>

        {rejected ? (
          <>
            <h1 className="text-[22px] font-bold text-[#111] dark:text-white mb-2">
              Application not approved
            </h1>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[15px] mb-4">
              Unfortunately your {roleLabel} application was not approved.
            </p>
            {profile?.rejection_reason && (
              <div className="text-left bg-[#f8f9fa] dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-4 mb-6">
                <p className="text-[12px] font-semibold text-[#54656f] dark:text-[#aebac1] uppercase tracking-wider mb-1">
                  Reason
                </p>
                <p className="text-[14px] text-[#111] dark:text-white">
                  {profile.rejection_reason}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-bold text-[#111] dark:text-white mb-2">
              Your application is under review
            </h1>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[15px] mb-6">
              Thanks for registering as a {roleLabel}, {profile?.full_name || "there"}. An
              administrator is reviewing your account. You'll be notified once it's approved
              and can then access your dashboard.
            </p>
          </>
        )}

        <div className="flex flex-col gap-3">
          {!rejected && (
            <Button
              onClick={() => refreshProfile()}
              className="w-full h-11 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[14px] font-bold"
            >
              Check status
            </Button>
          )}
          <button
            onClick={() => signOut()}
            className="w-full h-11 flex items-center justify-center gap-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white text-[14px] font-medium transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </Card>
    </div>
  );
}
