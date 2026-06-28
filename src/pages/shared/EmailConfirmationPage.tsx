import { useSearchParams, useNavigate } from "react-router-dom";
import { Mail, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useState } from "react";
import { Card } from "@/components/ui/Card";

export function EmailConfirmationPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      toast.success("Confirmation email resent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] p-4 font-sans">
      <Card className="w-full max-w-[500px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] shadow-2xl relative overflow-hidden">
        
        {/* Close Button */}
        <button 
          onClick={() => navigate("/login")}
          className="absolute right-4 top-4 text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white transition-colors p-1"
        >
          <X size={20} strokeWidth={1.5} />
        </button>

        <div className="p-10 flex flex-col items-center text-center">
          
          {/* Icon Illustration */}
          <div className="relative mb-8 mt-2">
            <div className="w-24 h-24 bg-[#1099A1]/10 rounded-full flex items-center justify-center">
              <Mail className="w-12 h-12 text-[#1099A1]" strokeWidth={1.5} />
            </div>
            {/* Subtle decorative elements */}
            <div className="absolute -bottom-2 -left-4 w-8 h-1 bg-[#e9edef] dark:bg-[#2a3942] rounded-full" />
            <div className="absolute -bottom-2 left-6 w-12 h-1 bg-[#e9edef] dark:bg-[#2a3942] rounded-full" />
            <div className="absolute -bottom-2 -right-2 w-6 h-1 bg-[#e9edef] dark:bg-[#2a3942] rounded-full" />
          </div>

          <h1 className="text-[26px] font-bold text-[#111] dark:text-white mb-4">
            Email Confirmation
          </h1>
          
          <p className="text-[15px] text-[#54656f] dark:text-[#aebac1] leading-relaxed mb-10 max-w-[400px]">
            We have sent email to <a href={`mailto:${email}`} className="text-[#1099A1] font-medium hover:underline">{email || "your email address"}</a> to confirm the validity of your email address. After receiving the email follow the link provided to complete your registration.
          </p>

          <div className="w-full h-px bg-[#e9edef] dark:bg-[#2a3942] mb-6" />

          <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">
            If you not got any mail{" "}
            <button 
              onClick={handleResend}
              disabled={resending || !email}
              className="text-[#1099A1] font-semibold hover:underline disabled:opacity-50"
            >
              {resending ? "Resending..." : "Resend confirmation mail"}
            </button>
          </p>

        </div>
      </Card>
    </div>
  );
}
