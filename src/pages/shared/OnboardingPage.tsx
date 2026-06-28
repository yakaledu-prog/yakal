import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Camera, Moon, Sun } from "lucide-react";
import { cn } from "@/utils/cn";

export function OnboardingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setTheme((profile.theme as "light" | "dark") || "light");
      setAvatarUrl(profile.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`);
    }
  }, [profile, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          theme,
          avatar_url: avatarUrl,
          is_onboarded: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Profile setup complete!");
      
      // Apply theme
      if (theme === 'dark') document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");

      // Navigate to dashboard
      navigate("/student"); 
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      <Card className="w-full max-w-[500px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-xl p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-bold text-[#111] dark:text-white mb-2">Welcome to Yakal!</h1>
          <p className="text-[#54656f] dark:text-[#aebac1] text-[15px]">Let's complete your profile setup</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Avatar Selection */}
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer mb-2">
              <img 
                src={avatarUrl || `https://ui-avatars.com/api/?name=${fullName || 'User'}&background=1099A1&color=fff`} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover ring-4 ring-[#1099A1]/20"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="text-white w-8 h-8" />
              </div>
            </div>
            <span className="text-[12px] text-[#54656f] dark:text-[#aebac1]">Click to change (Mock)</span>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#111] dark:text-white mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-[#1099A1] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#111] dark:text-white mb-1.5">Preferred Theme</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={cn(
                  "flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors",
                  theme === 'light'
                    ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1]"
                    : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                )}
              >
                <Sun size={18} />
                <span className="text-[14px] font-medium">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={cn(
                  "flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors",
                  theme === 'dark'
                    ? "border-[#1099A1] bg-[#1099A1]/10 text-[#1099A1]"
                    : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                )}
              >
                <Moon size={18} />
                <span className="text-[14px] font-medium">Dark</span>
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-xl text-[15px] font-bold mt-4"
            disabled={loading}
          >
            {loading ? "Saving..." : "Continue to Dashboard"}
          </Button>

        </form>
      </Card>
    </div>
  );
}
