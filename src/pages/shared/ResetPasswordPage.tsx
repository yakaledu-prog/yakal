import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import logoImg from "@/assets/images/logo.webp";

// ============================================================
// Setting a new password from a recovery link.
//
// Supabase parses the recovery token out of the URL when the client loads
// (detectSessionInUrl), which establishes a short-lived session and fires
// PASSWORD_RECOVERY. That session is the only thing that authorises the
// updateUser call below, so the page waits for it before showing the form and
// treats its absence as an expired or invalid link.
// ============================================================

const MIN_LENGTH = 8;

type Status = "checking" | "ready" | "invalid";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The client usually has the recovery session in hand by the time this
    // mounts, because it reads the URL on load. Check for it, and also listen
    // in case the event lands a moment later.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setStatus("ready");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    // No session and no recovery event means the link is stale or was opened
    // directly. Give it a moment, then say so rather than spinning forever.
    const timer = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 3000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      return setError(`Use at least ${MIN_LENGTH} characters.`);
    }
    if (password !== confirm) {
      return setError("The two passwords do not match.");
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    toast.success("Your password has been updated.");
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-[24px] border border-[#e9edef] bg-white p-8 shadow-xl dark:border-[#2a3942] dark:bg-[#202c33]">
        <Link to="/" className="mb-6 flex justify-center hover:opacity-80 transition-opacity">
          <img src={logoImg} alt="Yakal" className="h-12 object-contain" />
        </Link>

        {status === "checking" ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : status === "invalid" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary/15 text-secondary">
              <AlertCircle size={28} />
            </div>
            <h1 className="text-[20px] font-bold text-[#111] dark:text-white">Link expired</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
              This password reset link is invalid or has expired. Request a new one and try again.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-block h-11 rounded-xl bg-primary px-6 text-[14px] font-semibold leading-[44px] text-white hover:bg-primary-hover"
            >
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-tertiary/20 text-primary">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-[22px] font-bold text-[#111] dark:text-white">Password updated</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
              You are signed in with your new password.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-white hover:bg-primary-hover"
            >
              Continue
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex justify-center text-primary">
              <Lock size={32} strokeWidth={1.5} />
            </div>
            <h1 className="text-center text-[22px] font-bold text-[#111] dark:text-white">
              Set a new password
            </h1>
            <p className="mt-2 text-center text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
              Choose a password you have not used here before.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#111] dark:text-white">
                  New password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#e9edef] bg-transparent px-4 py-3 text-[14px] text-[#111] transition-colors focus:border-primary focus:outline-none dark:border-[#2a3942] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#111] dark:text-white">
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter it"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-[#e9edef] bg-transparent px-4 py-3 text-[14px] text-[#111] transition-colors focus:border-primary focus:outline-none dark:border-[#2a3942] dark:text-white"
                />
              </div>

              {error && <p className="text-[13px] text-red-500">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-white hover:bg-primary-hover"
              >
                {loading ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
