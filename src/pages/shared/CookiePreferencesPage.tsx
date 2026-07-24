import { PageWrapper } from "@/components/ui/PageWrapper";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";

export function CookiePreferencesPage() {
  return (
    <PageWrapper className="!p-0">
      <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-background dark:bg-[#111b21]">
        
        {/* Left Sidepane */}
        <div className="w-full md:w-[40%] lg:w-[35%] bg-black text-white relative flex flex-col p-8 md:p-12 lg:p-16 shrink-0 h-auto md:h-full">
          <img src={imgCover} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="mb-auto">
              <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-[14px] font-medium transition-colors">
                <ArrowLeft size={16} /> Back to home
              </Link>
            </div>
            
            <div className="mt-12 md:mt-0">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">Cookie<br/>Preferences</h1>
              <p className="text-white/80 text-[16px] md:text-[18px]">
                Effective Date: July 2026
              </p>
            </div>
          </div>
        </div>

        {/* Right Side Content */}
        <div className="flex-1 w-full p-6 md:p-12 lg:p-16 md:overflow-y-auto">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-3xl text-[#111] dark:text-[#d1d5db]">
            
            <h3 className="text-xl font-bold text-[#1099A1] mb-2 mt-0">1. What Are Cookies?</h3>
            <p className="mb-8">
              Cookies are small data files stored on your hard drive or in device memory that help us improve our services and your experience, see which areas and features of our services are popular, and count visits.
            </p>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">2. Types of Cookies We Use</h3>
            <p className="mb-8">
              We use both essential cookies, which are required for the operation of our platform, and analytics cookies, which help us understand how users interact with our site.
            </p>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">3. Managing Your Cookies</h3>
            <p className="mb-8">
              Most web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove or reject browser cookies.
            </p>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">4. Changes to This Policy</h3>
            <p className="mb-8">
              We may update this policy from time to time to reflect changes in technology, regulation, or our business practices.
            </p>

          </div>
        </div>
        
      </div>
    </PageWrapper>
  );
}
