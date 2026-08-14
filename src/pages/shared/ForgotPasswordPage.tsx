import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import logoImg from "@/assets/images/logo.webp";

// ============================================================
// "I forgot my password."
//
// Sends a recovery email through Supabase Auth, which lands the user on
// /reset-password with a one-time recovery session. Locally that email is
// caught by Mailpit; in production it goes out over the project's configured
// SMTP.
//
// The confirmation is deliberately the same whether or not an account uses the
// address. resetPasswordForEmail does not report which, and neither should the
// screen: "we sent it if it exists" is what stops this being a way to find out
// who has an account.
// ============================================================

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      // redirectTo must be allow-listed in Supabase Auth (config.toml locally,
      // the dashboard in production), or Auth falls back to the site URL.
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Success either way: an error here usually means a rate limit or a bad
      // address, and revealing that turns the form into an account probe.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-[24px] border border-[#e9edef] bg-white p-8 shadow-xl dark:border-[#2a3942] dark:bg-[#202c33]">
        <Link to="/" className="mb-6 flex justify-center hover:opacity-80 transition-opacity">
          <img src={logoImg} alt="Yakal" className="h-12 object-contain" />
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-tertiary/20 text-primary">
              <MailCheck size={28} />
            </div>
            <h1 className="text-[22px] font-bold text-[#111] dark:text-white">Check your email</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
              If an account uses <span className="font-semibold break-all">{email.trim()}</span>, we
              have sent a link to reset its password. It expires in an hour.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-primary hover:underline"
            >
              <ArrowLeft size={15} /> Back to log in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-[22px] font-bold text-[#111] dark:text-white">
              Reset your password
            </h1>
            <p className="mt-2 text-center text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
              Enter the email for your account and we will send you a link to set a new password.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#111] dark:text-white">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#e9edef] bg-transparent px-4 py-3 text-[14px] text-[#111] transition-colors focus:border-primary focus:outline-none dark:border-[#2a3942] dark:text-white"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-white hover:bg-primary-hover"
              >
                {loading ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Send reset link"}
              </Button>
            </form>

            <Link
              to="/login"
              className="mt-5 flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-[#54656f] transition-colors hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white"
            >
              <ArrowLeft size={15} /> Back to log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
