import { PageWrapper } from "@/components/ui/PageWrapper";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import imgCover from "@/assets/images/landing-page/hero-cover.jpg";

export function PrivacyPolicyPage() {
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
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">Privacy<br/>Policy</h1>
              <p className="text-white/80 text-[16px] md:text-[18px]">
                Effective Date: July 2026
              </p>
            </div>
          </div>
        </div>

        {/* Right Side Content */}
        <div className="flex-1 w-full p-6 md:p-12 lg:p-16 md:overflow-y-auto">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-3xl text-[#111] dark:text-[#d1d5db]">
            
            {/* Written against what the platform actually does rather than a
                template. The previous text said we share information with
                "marketing partners", which we do not, and never mentioned the
                two things a reader of a children's education platform most
                needs told: that messages are scanned, and who the
                subprocessors are. */}
            <h3 className="text-xl font-bold text-primary mb-2 mt-0">1. Information we collect</h3>
            <p className="mb-4">
              Account details: name, email address, role, and optionally a phone number and a
              profile photo.
            </p>
            <p className="mb-4">
              For students: grade level, enrolled courses and counselling plans, assignments and
              grades, session history, college list and application progress, and any essays or
              documents uploaded.
            </p>
            <p className="mb-4">
              For tutors and counsellors: the background entered on a profile, including education,
              work history and certifications, and the resume uploaded during onboarding.
            </p>
            <p className="mb-4">
              Messages sent through the platform, and the automated safeguarding flags raised on
              them.
            </p>
            <p className="mb-8">
              Payment records of what was bought, when and for how much. Card numbers are held by
              Stripe and never by us. We also record basic technical information such as an IP
              address, used to rate limit public endpoints and keep the service working.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">2. Why we hold it</h3>
            <p className="mb-4">
              To run the service: matching students with tutors, scheduling and hosting sessions,
              tracking coursework and applications, taking payment, and paying tutors.
            </p>
            <p className="mb-8">
              To contact you about your account, sessions and payments. Newsletter email is
              separate and only goes to people who asked for it.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">3. Keeping students safe</h3>
            <p className="mb-8">
              Messages between people connected through Yakal are scanned automatically for contact
              details, requests to move the conversation off the platform, offers to pay outside it,
              and requests that a child keep something secret. Anything flagged is shown to a linked
              parent to review. A parent can also read their child&apos;s conversations. This is a
              deliberate safeguarding measure and applies to every account.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">4. Who else sees it</h3>
            <p className="mb-4">
              Inside Yakal, access follows role. A tutor sees the students they teach, a counsellor
              the students they advise, a parent their linked children including billing, and
              administrators what they need to run the platform.
            </p>
            <p className="mb-4">
              Outside Yakal we use Supabase for the database, files and sign-in; Stripe for card
              payments and tutor payouts; Zoom for video sessions; Google for Classroom coursework
              and Drive storage; Cloudinary for images; and Resend for email. The in-app and website
              assistants are given product documentation and public pricing only, never account
              data.
            </p>
            <p className="mb-8">
              Students do not need a Google account. The platform holds one operations account that
              owns the classes, so nobody is asked to sign in to Google. We do not sell personal
              information and we do not share it with advertisers.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">5. Children</h3>
            <p className="mb-8">
              Much of what we hold belongs to people under 18. A student under 18 is expected to be
              linked to a parent or guardian account, and that parent can see their child&apos;s
              coursework, sessions, billing and conversations. A parent may ask us to correct or
              delete their child&apos;s information at any time.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">6. How long we keep it, and your choices</h3>
            <p className="mb-4">
              Account and learning records are kept while the account is open. Payment records are
              kept as long as accounting rules require.
            </p>
            <p className="mb-4">
              Most of your information can be seen and edited from your profile page. You can
              unsubscribe from newsletter email from any newsletter we send; that does not stop
              email about your own sessions and payments.
            </p>
            <p className="mb-8">
              You can ask for a copy of what we hold, ask us to correct it, or ask us to delete it,
              using the contact details in the footer of this site.
            </p>

            <h3 className="text-xl font-bold text-primary mb-2">7. Security</h3>
            <p className="mb-8">
              Access to data is enforced at the database, not only in the interface, so a request
              for something an account is not entitled to is refused by the server. We take
              reasonable measures to protect information from loss, theft, misuse and unauthorised
              access.
            </p>

          </div>
        </div>
        
      </div>
    </PageWrapper>
  );
}
