import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { User, GraduationCap, Users, Compass, Info, ChevronDown } from "lucide-react";
import logoImg from "@/assets/images/logo.webp";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";
import { postAuthPath } from "@/utils/roleRoutes";
import { toast } from "sonner";
import { DEV_PREVIEW } from "@/config/dev";

type Mode = "login" | "signup";
type RoleType = "student" | "parent" | "tutor" | "counselor";

const DEMO_ACCOUNTS = [
  { email: "admin@yakal.com", name: "Almaz T.", role: "Administrator", img: "https://i.pravatar.cc/150?u=admin_yakal" },
  { email: "tutor@yakal.com", name: "Bethlehem A.", role: "Tutor", img: "https://i.pravatar.cc/150?u=tutor_yakal" },
  { email: "counselor@yakal.com", name: "Daniel Haile", role: "Counselor", img: "https://i.pravatar.cc/150?u=counselor_yakal" },
  { email: "student@yakal.com", name: "Amen Worku", role: "Student", img: "https://i.pravatar.cc/150?u=student_yakal" },
  { email: "parent@yakal.com", name: "Tigist Worku", role: "Parent", img: "https://randomuser.me/api/portraits/women/44.jpg" },
];

export function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // An invite link lands here with the address to use, whether to start on
  // signup, and where to go afterwards. Read once so the fields arrive filled
  // rather than flickering in from an effect.
  const nextPath = params.get("next");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  // Form State
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleType>("student");
  const [notice, setNotice] = useState<string | null>(null);

  const [phone, setPhone] = useState("");  // Fetch the just-authenticated user's profile and route by role/status/onboarding.
  const routeByProfile = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, status, is_onboarded")
      .eq("id", userId)
      .single();
    navigate(postAuthPath(prof));
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setDemoLoading(demoEmail);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: "demo123",
      });

      if (error) throw error;

      toast.success("Logged in successfully!");
      if (data.user) await routeByProfile(data.user.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to login demo account.");
    } finally {
      setDemoLoading(null);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        // An invite link (or any ?next=) wins over the default landing page, so
        // an existing child lands back on the invite to accept it.
        if (nextPath) {
          navigate(nextPath);
        } else if (data.user) {
          await routeByProfile(data.user.id);
        }
      } else {


        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: selectedRole,
              ...(phone ? { phone } : {}),
            }
          }
        });
        if (error) throw error;

        // Supabase returns an obfuscated user with an EMPTY identities array when
        // the email is already registered (to avoid leaking account existence).
        // Detect that and tell the user to log in instead of silently sending them
        // to the confirm-email screen.
        if (data?.user && (data.user.identities?.length ?? 0) === 0) {
          setMode("login");
          setPassword("");
          setNotice("You already have an account with this email. Please log in below.");
          return;
        }

        if (data?.session === null) {
          // Email confirmation is required
          navigate(`/confirm-email?email=${encodeURIComponent(email)}`);
        } else {
          // New account: profile trigger has run; go complete onboarding.
          toast.success("Account created successfully!");
          navigate("/onboarding");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-[#f8f9fa] dark:bg-[#111b21]">

      {/* Left side: Immersive Image (Hidden on small screens) */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={imgCover} alt="Yakal Education" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Optional text overlay on the image */}
        <div className="absolute bottom-16 left-16 right-16">
          <h2 className="text-[42px] font-bold text-white mb-4 leading-[50px] max-w-[500px]">
            Personalized tutoring for students who want to excel.
          </h2>
          <p className="text-[18px] text-white/90 max-w-[450px] leading-[28px]">
            Expert guidance, flexible scheduling, and tailored learning plans to help you achieve your academic goals.
          </p>
        </div>
      </div>

      {/* Right side: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-[420px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl p-8">

          {/* Header */}
          <Link to="/" className="flex items-center gap-3 mb-6 justify-center hover:opacity-80 transition-opacity">
            <img src={logoImg} alt="Yakal" className="h-12 object-contain" />
          </Link>

          {/* Toggle */}
          <div className="flex bg-[#f0f2f5] dark:bg-[#111b21] p-1 rounded-xl mb-6">
            <button
              onClick={() => { setMode("login"); setNotice(null); }}
              className={cn(
                "flex-1 py-2 text-[14px] font-semibold rounded-lg transition-colors",
                mode === "login"
                  ? "bg-white dark:bg-[#202c33] text-[#111] dark:text-white shadow-sm"
                  : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
              )}
            >
              Log in
            </button>
            <button
              onClick={() => { setMode("signup"); setNotice(null); }}
              className={cn(
                "flex-1 py-2 text-[14px] font-semibold rounded-lg transition-colors",
                mode === "signup"
                  ? "bg-white dark:bg-[#202c33] text-[#111] dark:text-white shadow-sm"
                  : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
              )}
            >
              Sign up
            </button>
          </div>

          {notice && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-secondary/40 bg-secondary/10 px-3.5 py-3 text-[13px] text-[#8a6d34] dark:text-[#e0c48a]">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">

            {/* Sign Up Fields */}
            {mode === "signup" && (
              <>
                {/* Role Toggle */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {(['student', 'parent', 'tutor', 'counselor'] as RoleType[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={cn(
                        "py-3 border rounded-xl flex flex-col items-center gap-1 transition-colors",
                        selectedRole === role
                          ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                          : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                      )}
                    >
                      {role === 'student' && <User size={20} />}
                      {role === 'parent' && <Users size={20} />}
                      {role === 'tutor' && <GraduationCap size={20} />}
                      {role === 'counselor' && <Compass size={20} />}
                      <span className="text-[12px] font-medium capitalize">{role}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#111] dark:text-white mb-1.5">Full name</label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Phone Field for select roles */}
                {(selectedRole === "parent" || selectedRole === "tutor" || selectedRole === "counselor") && (
                  <div>
                    <label className="block text-[13px] font-medium text-[#111] dark:text-white mb-1.5">Phone number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 234 567 8900"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                )}
              </>
            )}

            {/* Common Fields */}
            <div>
              <label className="block text-[13px] font-medium text-[#111] dark:text-white mb-1.5">Email</label>
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#111] dark:text-white mb-1.5">Password</label>
              <input
                type="password"
                required
                placeholder={mode === 'signup' ? "Choose a password" : "••••••••"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {mode === "login" && (
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary-hover text-white rounded-xl text-[15px] font-bold mt-2"
              disabled={loading}
            >
              {loading ? "Please wait..." : (mode === "login" ? "Log in" : "Create account")}
            </Button>
          </form>

          {/* One-click demo logins. Hidden unless DEV_PREVIEW is on, so a
              production sign-in page never advertises accounts whose password
              is published in this repository. */}
          {mode === "login" && DEV_PREVIEW && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-[#e9edef] dark:bg-[#2a3942]" />
                <span className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium uppercase tracking-wider">Or</span>
                <div className="flex-1 h-px bg-[#e9edef] dark:bg-[#2a3942]" />
              </div>

              <button
                type="button"
                onClick={() => setShowDemo(!showDemo)}
                className="flex items-center justify-center gap-1 w-full text-center text-[13px] font-medium text-[#54656f] dark:text-[#aebac1] mb-2 hover:text-[#111] dark:hover:text-white transition-colors"
              >
                Try demo accounts
                <ChevronDown size={14} className={`transition-transform duration-300 ${showDemo ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-all duration-300 ease-in-out ${showDemo ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {DEMO_ACCOUNTS.map(acc => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleDemoLogin(acc.email)}
                        disabled={!!demoLoading}
                        className="flex items-center gap-3 p-3 bg-[#f8f9fa] dark:bg-[#111b21] rounded-xl border border-transparent hover:border-[#e9edef] dark:hover:border-[#2a3942] transition-colors text-left"
                      >
                        <img src={acc.img} alt={acc.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-[#111] dark:text-white truncate">
                            {demoLoading === acc.email ? "Loading..." : acc.name}
                          </div>
                          <div className="text-[11px] text-[#54656f] dark:text-[#aebac1]">
                            {acc.role}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </Card>
      </div>
    </div>
  );
}
