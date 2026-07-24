import { PageWrapper } from "@/components/ui/PageWrapper";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function CancellationPolicyPage() {
  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-24">
        {/* Header */}
        <div className="bg-[#1099A1] text-white pt-10 px-6 md:px-10 relative overflow-hidden pb-12">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>
          <div className="relative z-10 max-w-[800px] mx-auto pt-8">
            <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 text-[14px] font-medium transition-colors">
              <ArrowLeft size={16} /> Back to home
            </Link>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Cancellation Policy</h1>
            <p className="text-white/80 text-[16px] md:text-[18px]">
              Effective Date: July 2026
            </p>
          </div>
        </div>

        <div className="max-w-[800px] mx-auto p-6 md:p-10 -mt-6">
          <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-8 md:p-12 shadow-sm prose prose-sm md:prose-base dark:prose-invert max-w-none text-[#111] dark:text-[#d1d5db]">
            
            <h3 className="text-xl font-bold text-[#1099A1] mb-2 mt-0">1. General Policy</h3>
            <p className="mb-8">
              At Yakal Education Services, we understand that unforeseen circumstances may arise. To maintain the quality of our services and respect the time of our tutors, we have established the following cancellation policy.
            </p>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">2. Session Cancellation</h3>
            <ul className="list-disc pl-5 mb-8 space-y-2">
              <li><strong>Notice Requirement:</strong> Clients must provide at least 24 hours' notice to cancel or reschedule a session without incurring a fee.</li>
              <li><strong>Late Cancellations:</strong> Cancellations made less than 24 hours before the scheduled session will incur a fee equivalent to 50% of the session cost.</li>
              <li><strong>No-Shows:</strong> Failure to attend a scheduled session without prior notice will result in a charge for the full session fee.</li>
            </ul>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">3. Rescheduling Policy</h3>
            <ul className="list-disc pl-5 mb-8 space-y-2">
              <li>Sessions can be rescheduled without penalty if a 24-hour notice is provided.</li>
              <li>Rescheduling requests made within 24 hours of the session will be subject to the same fees as late cancellations.</li>
            </ul>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">4. Emergency Cancellations</h3>
            <p className="mb-8">
              We understand that emergencies happen. In cases of illness, accidents, or other genuine emergencies, please contact us as soon as possible. We may waive cancellation fees at our discretion.
            </p>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">5. Tutor Cancellations</h3>
            <ul className="list-disc pl-5 mb-8 space-y-2">
              <li>If a tutor needs to cancel a session, we will notify the client promptly and offer to reschedule at the earliest convenience.</li>
              <li>In rare cases where rescheduling is not possible, no fees will be charged.</li>
            </ul>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">6. Payment and Refunds</h3>
            <ul className="list-disc pl-5 mb-8 space-y-2">
              <li>Cancellation fees will be charged to the payment method on file.</li>
              <li>Prepaid sessions canceled within the required notice period will be fully credited or refunded.</li>
              <li>No refunds will be issued for late cancellations or no-shows.</li>
            </ul>

            <h3 className="text-xl font-bold text-[#1099A1] mb-2">7. Policy Acknowledgment</h3>
            <p className="mb-4">
              By scheduling sessions with Yakal Education Services, clients acknowledge and agree to this cancellation policy.
            </p>
            <p className="mb-0">
              For any questions or concerns regarding this policy, please contact us at <a href="mailto:info@yakal.com" className="text-[#1099A1] hover:underline">info@yakal.com</a>.
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
