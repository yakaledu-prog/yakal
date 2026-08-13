import { PageWrapper } from "@/components/ui/PageWrapper";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";

export function TermsConditionsPage() {
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
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">Terms &<br/>Conditions</h1>
              <p className="text-white/80 text-[16px] md:text-[18px]">
                Effective Date: July 2026
              </p>
            </div>
          </div>
        </div>

        {/* Right Side Content */}
        <div className="flex-1 w-full p-6 md:p-12 lg:p-16 md:overflow-y-auto">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-3xl text-[#111] dark:text-[#d1d5db]">
            
            <h3 className="text-xl font-bold text-primary mb-2 mt-0">1. Acceptance of Terms</h3>
            <p className="mb-8">
              By accessing and using Yakal Education Services, you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">2. Use of Service</h3>
            <p className="mb-8">
              Our service provides educational resources and tutoring. You agree to use the service for its intended purpose and not for any unlawful activity.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">3. User Accounts</h3>
            <p className="mb-8">
              Users are responsible for maintaining the confidentiality of their account information, including passwords. Any activities that occur under your account are your responsibility.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">4. Modifications to Service</h3>
            <p className="mb-8">
              We reserve the right to modify or discontinue, temporarily or permanently, the service with or without notice.
            </p>

          </div>
        </div>
        
      </div>
    </PageWrapper>
  );
}
