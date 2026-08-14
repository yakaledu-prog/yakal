import { useState } from "react";
import { toast } from "sonner";
import { subscribeToNewsletter } from "@/services/newsletterService";

interface NewsletterSignupProps {
  source?: string;
  tone?: "light" | "dark";
}

export default function NewsletterSignup({
  source = "footer",
  tone = "dark",
}: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      toast.error("Please enter your email address.");
      return;
    }

    setSaving(true);
    const res = await subscribeToNewsletter(value, source);
    setSaving(false);
    if (res.error) return toast.error(res.error);

    toast.success("Thanks for joining our newsletter. Check your inbox.");
    setEmail("");
  }

  const isDark = tone === "dark";

  return (
    <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-[10px]">
      <label className="sr-only" htmlFor={`newsletter-email-${source}`}>
        Email address
      </label>
      <input
        id={`newsletter-email-${source}`}
        type="email"
        autoComplete="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`min-w-0 flex-1 px-[16px] py-[13px] rounded-[500px] text-[14px] outline-none transition-colors ${
          isDark
            ? "bg-[rgba(255,255,255,0.2)] border-none text-white placeholder:text-[rgba(255,255,255,0.75)] focus:bg-[rgba(255,255,255,0.28)]"
            : "bg-white border border-black/10 text-[#111827] placeholder:text-[#6b7280] focus:border-primary"
        }`}
      />
      <button
        type="submit"
        disabled={saving}
        className="bg-primary px-[22px] py-[13px] rounded-[500px] uppercase hover:bg-primary-hover transition-colors text-white text-[14px] font-medium whitespace-nowrap disabled:opacity-60"
      >
        {saving ? "Adding..." : "Subscribe"}
      </button>
    </form>
  );
}
