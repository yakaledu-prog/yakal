import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { User, GraduationCap, Users } from "lucide-react";
import logoImg from "@/assets/images/logo.webp";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

type Mode = "login" | "signup";
type RoleType = "student" | "parent" | "tutor";

const DEMO_ACCOUNTS = [
  { email: "admin@yakal.com", name: "Almaz T.", role: "Administrator", img: "https://i.pravatar.cc/150?u=admin_yakal" },
  { email: "parent@yakal.com", name: "Tigist Worku", role: "Parent", img: "https://randomuser.me/api/portraits/women/44.jpg" },
  { email: "student@yakal.com", name: "Amen Worku", role: "Student", img: "https://i.pravatar.cc/150?u=student_yakal" },
  { email: "tutor@yakal.com", name: "Bethlehem A.", role: "Tutor", img: "https://i.pravatar.cc/150?u=tutor_yakal" },
];

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleType>("student");

  const handleDemoLogin = async (demoEmail: string) => {
    setDemoLoading(demoEmail);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: "demo123",
      });

      if (error) throw error;

      // The AuthProvider will handle the state, we just navigate
      // Wait a tiny bit for context to update if needed, then route
      toast.success("Logged in successfully!");
      navigate("/student"); // Ideally route based on their role
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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/student");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: selectedRole,
            }
          }
        });
        if (error) throw error;

        if (data?.session === null) {
          // Email confirmation is required
          navigate(`/confirm-email?email=${encodeURIComponent(email)}`);
        } else {
          toast.success("Account created successfully!");
          navigate("/student");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      <Card className="w-full max-w-[420px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl shadow-lg p-6">

        {/* Header */}
        <Link to="/" className="flex items-center gap-3 mb-6 justify-center hover:opacity-80 transition-opacity">
          <img src={logoImg} alt="Yakal" className="h-12 object-contain" />
        </Link>

        {/* Toggle */}
        <div className="flex bg-[#f0f2f5] dark:bg-[#111b21] p-1 rounded-xl mb-6">
          <button
            onClick={() => setMode("login")}
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
            onClick={() => setMode("signup")}
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

        <form onSubmit={handleAuth} className="space-y-4">

          {/* Sign Up Fields */}
          {mode === "signup" && (
            <>
              {/* Role Toggle */}
              <div className="flex gap-2 mb-4">
                {(['student', 'parent', 'tutor'] as RoleType[]).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      "flex-1 py-3 border rounded-xl flex flex-col items-center gap-1 transition-colors",
                      selectedRole === role
                        ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1] dark:bg-[#1099A1]/10"
                        : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                    )}
                  >
                    {role === 'student' && <User size={20} />}
                    {role === 'parent' && <Users size={20} />}
                    {role === 'tutor' && <GraduationCap size={20} />}
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
                  className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-[#1099A1] transition-colors"
                />
              </div>
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
              className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-[#1099A1] transition-colors"
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
              className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-[#1099A1] transition-colors"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[15px] font-bold mt-2"
            disabled={loading}
          >
            {loading ? "Please wait..." : (mode === "login" ? "Log in" : "Create account")}
          </Button>
        </form>

        {/* Demo Section */}
        {mode === "login" && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-[#e9edef] dark:bg-[#2a3942]" />
              <span className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium uppercase tracking-wider">Or</span>
              <div className="flex-1 h-px bg-[#e9edef] dark:bg-[#2a3942]" />
            </div>

            <p className="text-center text-[13px] text-[#54656f] dark:text-[#aebac1] mb-4">
              try demo accounts
            </p>

            <div className="grid grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
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
        )}

      </Card>
    </div>
  );
}
