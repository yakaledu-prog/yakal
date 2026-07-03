import React, { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, Copy, FileText, Check, AlertCircle, Video, Server, Users, 
  CreditCard, LayoutDashboard, Code2, CheckSquare, Globe, Key, CalendarClock,
  PieChart, Film, Star, HelpCircle, Languages, Bell, BarChart, ShieldAlert,
  Repeat
} from "lucide-react";
import { cn } from "@/utils/cn";
import toast from "react-hot-toast";

const SECTIONS = [
  { id: "overview", title: "Project Overview", icon: <FileText size={18} /> },
  { id: "portals", title: "User Portals", icon: <LayoutDashboard size={18} /> },
  { id: "auth", title: "Authentication", icon: <Key size={18} /> },
  { id: "onboarding", title: "Who can be tutor", icon: <Users size={18} /> },
  { id: "courses", title: "Course Creation", icon: <Code2 size={18} /> },
  { id: "booking", title: "Session Booking", icon: <CalendarClock size={18} /> },
  { id: "payment", title: "Payment Strategy", icon: <CreditCard size={18} /> },
  { id: "commission", title: "Revenue Split", icon: <PieChart size={18} /> },
  { id: "video", title: "Video Conferencing", icon: <Video size={18} /> },
  { id: "recordings", title: "Session Recordings", icon: <Film size={18} /> },
  { id: "reviews", title: "Review System", icon: <Star size={18} /> },
  { id: "support", title: "Customer Support", icon: <HelpCircle size={18} /> },
  { id: "language", title: "Localization", icon: <Languages size={18} /> },
  { id: "notifications", title: "Notifications", icon: <Bell size={18} /> },
  { id: "analytics", title: "Admin Analytics", icon: <BarChart size={18} /> },
  { id: "refunds", title: "Refund Policy", icon: <ShieldAlert size={18} /> },
  { id: "infrastructure", title: "Infrastructure", icon: <Server size={18} /> },
  { id: "domain", title: "Domain Selection", icon: <Globe size={18} /> },
  { id: "summary", title: "Final Summary", icon: <CheckSquare size={18} /> },
];

interface CostBreakdown {
  devCost: number;
  recurring?: { amount: number, period: 'mo' | 'yr' };
  recurringText?: string;
}

// Dev costs are extremely low, reflecting only the delta on top of the $300 base for one-time work.
// Recurring costs reflect actual 3rd-party SaaS fees the client will have to pay.
const OPTION_PRICES: Record<string, CostBreakdown> = {
  // Auth
  "Email & Password": { devCost: 0, recurringText: "$0/mo" },
  "Social Login": { devCost: 20, recurringText: "$0/mo" },
  "Phone Number OTP": { devCost: 40, recurring: { amount: 15, period: 'mo' }, recurringText: "~$15/mo (SMS API)" },
  
  // Onboarding
  "Anyone can be tutor": { devCost: 0 },
  "Limited / Fixed Tutors (Selected)": { devCost: 30 },

  // Courses
  "Tutor-Driven Marketplace": { devCost: 0 },
  "Fixed Courses": { devCost: 15 },

  // Booking
  "Scheduled Calendar Booking": { devCost: 0 },
  "On-Demand / Instant Match": { devCost: 80 },

  // Payment
  "Course-based": { devCost: 0 },
  "Subscription": { devCost: 20 },
  "Pay-per-Session": { devCost: 70 },

  // Commission
  "Flat Subscription Fee": { devCost: 0 },
  "Automated Percentage Split": { devCost: 40 },

  // Video
  "External Links": { devCost: 0, recurringText: "$0/mo" },
  "Jitsi Meet": { devCost: 15, recurringText: "$0/mo" },
  "Zoom SDK": { devCost: 40, recurring: { amount: 100, period: 'mo' }, recurringText: "~$100/mo (Zoom Pro)" },
  "Self-Hosted": { devCost: 100, recurring: { amount: 150, period: 'mo' }, recurringText: "~$150/mo (Server Rentals)" },

  // Recordings
  "No Recordings": { devCost: 0 },
  "Manual Link Pasting": { devCost: 0 },
  "Automated Cloud Sync": { devCost: 30, recurring: { amount: 40, period: 'mo' }, recurringText: "~$40/mo (Storage)" },

  // Reviews
  "No Reviews": { devCost: 0 },
  "Auto-Published Ratings": { devCost: 15 },
  "Admin-Moderated": { devCost: 25 },

  // Support
  "Email Only": { devCost: 0 },
  "Embedded Chat Widget": { devCost: 10, recurring: { amount: 30, period: 'mo' }, recurringText: "~$30/mo (Intercom)" },
  "Custom Ticket System": { devCost: 60 },

  // Language
  "English Only": { devCost: 0 },
  "Bilingual (English + Amharic)": { devCost: 60 },

  // Notifications
  "In-App Only": { devCost: 0 },
  "Email Alerts": { devCost: 15, recurring: { amount: 15, period: 'mo' }, recurringText: "~$15/mo (SendGrid)" },
  "Push / SMS Alerts": { devCost: 40, recurring: { amount: 20, period: 'mo' }, recurringText: "~$20/mo (Twilio)" },

  // Analytics
  "Basic Counters": { devCost: 0 },
  "Advanced Graphical Dashboard": { devCost: 30 },

  // Refunds
  "Manual Refunds (Admin handled)": { devCost: 0 },
  "Automated Dispute System": { devCost: 60 },

  // Infrastructure
  "Serverless": { devCost: 0, recurringText: "$0/mo (Vercel Free Tier)" },
  "VPS": { devCost: 20, recurring: { amount: 20, period: 'mo' }, recurringText: "~$20/mo (AWS/DigitalOcean)" },
  "Local Cloud (Ethiopia)": { devCost: 30, recurring: { amount: 30, period: 'mo' }, recurringText: "~$30/mo (Wingu Africa)" },

  // Domains
  "yakal.org": { devCost: 0, recurring: { amount: 8, period: 'yr' }, recurringText: "~$8/yr" },
  "yakal.net": { devCost: 0, recurring: { amount: 12, period: 'yr' }, recurringText: "~$12/yr" },
  "yakal.ai": { devCost: 0, recurring: { amount: 90, period: 'yr' }, recurringText: "~$90/yr" },
  "Local (.et)": { devCost: 0, recurring: { amount: 20, period: 'yr' }, recurringText: "~$20/yr (Ethio Telecom)" },
};

export function ProposalPage() {
  const [activeSection, setActiveSection] = useState("overview");

  // Form State
  const [choices, setChoices] = useState({
    auth: "",
    onboarding: "",
    courses: "",
    booking: "",
    paymentMode: "",
    gateways: [] as string[],
    commission: "",
    video: "",
    recordings: "",
    reviews: "",
    support: "",
    language: "",
    notifications: "",
    analytics: "",
    refunds: "",
    infrastructure: "",
    domainExt: "",
  });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150; // offset
      for (const section of SECTIONS) {
        const el = sectionRefs.current[section.id];
        if (el && el.offsetTop <= scrollPosition && el.offsetTop + el.offsetHeight > scrollPosition) {
          setActiveSection(section.id);
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      window.scrollTo({ top: el.offsetTop - 40, behavior: "smooth" });
    }
  };

  const updateChoice = (category: string, value: string) => {
    setChoices(prev => ({ ...prev, [category]: value }));
  };

  const toggleGateway = (gateway: string) => {
    setChoices(prev => ({
      ...prev,
      gateways: prev.gateways.includes(gateway)
        ? prev.gateways.filter(g => g !== gateway)
        : [...prev.gateways, gateway]
    }));
  };

  // Calculate Progress
  const totalDecisions = 16; 
  let completedDecisions = 0;
  if (choices.auth) completedDecisions++;
  if (choices.onboarding) completedDecisions++;
  if (choices.courses) completedDecisions++;
  if (choices.booking) completedDecisions++;
  if (choices.paymentMode) completedDecisions++;
  if (choices.commission) completedDecisions++;
  if (choices.video) completedDecisions++;
  if (choices.recordings) completedDecisions++;
  if (choices.reviews) completedDecisions++;
  if (choices.support) completedDecisions++;
  if (choices.language) completedDecisions++;
  if (choices.notifications) completedDecisions++;
  if (choices.analytics) completedDecisions++;
  if (choices.refunds) completedDecisions++;
  if (choices.infrastructure) completedDecisions++;
  if (choices.domainExt) completedDecisions++;

  const progressPercentage = (completedDecisions / totalDecisions) * 100;

  // Calculate Totals
  const BASE_PRICE = 300;
  let estimatedDevPrice = BASE_PRICE;
  let estimatedMonthly = 0;
  let estimatedYearly = 0;

  Object.entries(choices).forEach(([key, value]) => {
    if (typeof value === "string" && OPTION_PRICES[value] !== undefined) {
      estimatedDevPrice += OPTION_PRICES[value].devCost;
      const rec = OPTION_PRICES[value].recurring;
      if (rec) {
        if (rec.period === 'mo') estimatedMonthly += rec.amount;
        if (rec.period === 'yr') estimatedYearly += rec.amount;
      }
    }
  });
  
  // Add Gateway dev costs ($15 per additional gateway beyond the first)
  if (choices.gateways.length > 1) {
    estimatedDevPrice += (choices.gateways.length - 1) * 15;
  }

  const getContractLine = (label: string, choiceKey: keyof typeof choices) => {
    const val = choices[choiceKey] as string;
    if (!val) return `Selected: Pending Decision\n\n`;
    
    let text = `Selected: ${val}\n`;
    const cost = OPTION_PRICES[val];
    if (cost) {
      text += `- One-Time Dev Cost: ${cost.devCost === 0 ? "Included" : `+$${cost.devCost}`}\n`;
      if (cost.recurringText) {
        text += `- Ongoing SaaS Cost: ${cost.recurringText}\n`;
      }
    }
    return text + `\n`;
  };

  const generateContractText = () => {
    let text = `# Final Project Scope (PRD)\n\n`;
    text += `## Core Features & Portals (Included in Base $300)\n`;
    text += `- Progressive Web App (PWA) architecture.\n`;
    text += `- Static Public Landing page (Hardcoded, no CMS).\n`;
    text += `- Student Portal (Dashboard, Catalog, Calendar, Sessions).\n`;
    text += `- Tutor Portal (Availability Editor, Session Management).\n`;
    text += `- Basic Admin Portal (User management).\n`;
    text += `- File storage via Google Drive Links (No native file uploads).\n\n`;

    text += `## Selected Architectural Decisions\n\n`;
    
    text += `### 1. Authentication Method\n`;
    text += getContractLine("Authentication", "auth");

    text += `### 2. Who can be tutor\n`;
    text += getContractLine("Onboarding", "onboarding");

    text += `### 3. Course Creation Model\n`;
    text += getContractLine("Courses", "courses");

    text += `### 4. Session Booking Flow\n`;
    text += getContractLine("Booking", "booking");

    text += `### 5. Payment & Monetization\n`;
    text += getContractLine("Payment", "paymentMode");
    text += `Gateways: ${choices.gateways.length > 0 ? choices.gateways.join(", ") : "None Selected"}\n`;
    if (choices.gateways.length > 1) {
      text += `- One-Time Dev Cost: +$${(choices.gateways.length - 1) * 15} (For ${choices.gateways.length - 1} extra gateways)\n`;
    }
    text += `\n`;

    text += `### 6. Revenue Split Mechanism\n`;
    text += getContractLine("Commission", "commission");

    text += `### 7. Video Conferencing\n`;
    text += getContractLine("Video", "video");

    text += `### 8. Session Recordings\n`;
    text += getContractLine("Recordings", "recordings");

    text += `### 9. Review & Rating System\n`;
    text += getContractLine("Reviews", "reviews");

    text += `### 10. Customer Support\n`;
    text += getContractLine("Support", "support");

    text += `### 11. Localization (Languages)\n`;
    text += getContractLine("Language", "language");

    text += `### 12. Notification Strategy\n`;
    text += getContractLine("Notifications", "notifications");

    text += `### 13. Admin Analytics Dashboard\n`;
    text += getContractLine("Analytics", "analytics");

    text += `### 14. Refund Policy Engine\n`;
    text += getContractLine("Refunds", "refunds");

    text += `### 15. Infrastructure & Deployment\n`;
    text += getContractLine("Infrastructure", "infrastructure");

    text += `### 16. Domain Selection\n`;
    text += getContractLine("Domain", "domainExt");

    text += `## FINANCIAL SUMMARY\n`;
    text += `- ONE-TIME PROJECT FEE: $${estimatedDevPrice}\n`;
    text += `- ESTIMATED ONGOING COSTS: $${estimatedMonthly}/mo + $${estimatedYearly}/yr\n\n`;

    text += `## Out of Scope (Phase 2 Enhancements)\n`;
    text += `- Native iOS/Android App (Apple App Store / Google Play Store)\n`;
    text += `- Parent Portal (Child linking & monitoring)\n`;
    text += `- Real-time WebSockets Chat\n`;
    text += `- Landing Page CMS\n`;
    text += `- Voice Messages & Native File Uploads\n`;
    
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateContractText());
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex font-sans text-[#111]">
      
      {/* Sidebar */}
      <aside className="w-72 fixed h-full bg-white border-r border-[#e9edef] flex flex-col z-10 shadow-sm">
        
        {/* Pricing Widget */}
        <div className="p-6 border-b border-[#e9edef] bg-[#fff] relative overflow-hidden">
          
          {/* One Time Fee */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-[#54656f] uppercase tracking-wider mb-1">One-Time Project Fee</div>
            <div className="text-4xl font-black text-[#1099A1]">${estimatedDevPrice}</div>
            <div className="text-xs text-[#54656f] mt-1 flex justify-between">
              <span>Base MVP: ${BASE_PRICE}</span>
              <span>Custom Dev: +${estimatedDevPrice - BASE_PRICE}</span>
            </div>
          </div>

          {/* Operating Costs */}
          <div className="pt-4 border-t border-[#e9edef]">
            <div className="text-xs font-semibold text-[#54656f] uppercase tracking-wider mb-1">Estimated SaaS Costs</div>
            <div className="text-xl font-bold text-[#111]">
               ${estimatedMonthly}<span className="text-xs font-normal text-[#54656f]">/mo</span> 
               {estimatedYearly > 0 && <span className="ml-2">+ ${estimatedYearly}<span className="text-xs font-normal text-[#54656f]">/yr</span></span>}
            </div>
            <div className="text-xs text-[#54656f] mt-1 leading-tight">Paid directly to 3rd party providers (e.g., Domain, AWS, Zoom, Twilio).</div>
          </div>
          
        </div>

        {/* Progress Bar */}
        <div className="p-6 border-b border-[#e9edef] bg-[#f0faf0]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-[#1099A1]">Decisions Made</span>
            <span className="text-sm font-bold text-[#1099A1]">{completedDecisions} / {totalDecisions}</span>
          </div>
          <div className="h-2 w-full bg-[#e9edef] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1099A1] transition-all duration-500 ease-in-out" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {SECTIONS.map((section) => {
            const isCompleted = (choices as any)[section.id] || (section.id === 'payment' && choices.paymentMode);
            
            return (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-left text-sm font-medium transition-colors",
                activeSection === section.id 
                  ? "bg-[#1099A1] text-white" 
                  : "text-[#54656f] hover:bg-[#f0faf0] hover:text-[#1099A1]"
              )}
            >
              <span className={cn(
                "opacity-70",
                activeSection === section.id ? "text-white" : "text-[#1099A1]"
              )}>
                {section.icon}
              </span>
              {section.title}
              
              {/* Checkmark if section has a completed choice */}
              {isCompleted ? (
                <CheckCircle2 size={14} className={cn("ml-auto", activeSection === section.id ? "text-white" : "text-[#1099A1]")} />
               ) : null}
            </button>
          )})}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-72 flex-1 p-10 lg:p-16 max-w-5xl">
        
        {/* Header Section */}
        <div className="mb-10 pb-6 border-b border-[#e9edef]">
          <h1 className="text-4xl font-bold text-[#1099A1] mb-2">Scope Builder</h1>
          <p className="text-lg text-[#54656f]">Review the proposal and finalize your decisions.</p>
        </div>

        {/* Section 1: Overview */}
        <section 
          id="overview" 
          ref={el => sectionRefs.current['overview'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl mb-6">
            <FileText size={24} />
          </div>
          <h2 className="text-3xl font-bold mb-6 text-[#111]">1. Project Overview</h2>
          
          <div className="prose prose-slate max-w-none space-y-4 text-[#54656f] leading-relaxed">
            <p>
              Yakal is a web-based tutoring platform that connects students with tutors for personalized academic support. The platform supports online and in-person sessions across diverse subjects such as <strong>Mathematics, Physics, Chemistry, SAT Prep, and College Advising</strong>.
            </p>
            <p>
              The system serves three core user roles for the Base MVP: <strong>Students</strong>, <strong>Tutors</strong>, and <strong>Administrators</strong>. (Parent portals and advanced tracking are scoped for Phase 2).
            </p>
            
            <div className="bg-[#f8f9fa] p-5 rounded-lg border border-[#e9edef] my-6">
              <h4 className="font-semibold text-[#111] flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-[#1099A1]" /> Progressive Web App (PWA)
              </h4>
              <p className="text-sm">
                The web application will be built as a Progressive Web App (PWA). Users can "Install" the app directly from their mobile Safari or Chrome browser to their home screen. It will look and feel like a native app (icon on home screen, fullscreen window) without the high cost and 30% revenue sharing requirements of the Apple App Store and Google Play Store.
              </p>
            </div>

            <div className="bg-[#fff9e6] p-5 rounded-lg border border-[#f0e6cc] my-6">
              <h4 className="font-semibold text-[#111] flex items-center gap-2 mb-3">
                <AlertCircle size={18} className="text-[#CAA25F]" /> File Storage Strategy
              </h4>
              <p className="text-sm text-[#8c7335]">
                To avoid expensive, recurring AWS/Cloud storage costs in Phase 1, <strong>all large files (PDFs, Videos, Worksheets) will be managed via Google Drive links</strong>. Tutors will upload files to their own Google Drive and paste the shareable URL into the platform. There is no native file upload feature, ensuring your server costs remain incredibly low.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Portals */}
        <section 
          id="portals" 
          ref={el => sectionRefs.current['portals'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl mb-6">
            <LayoutDashboard size={24} />
          </div>
          <h2 className="text-3xl font-bold mb-6 text-[#111]">2. User Portals</h2>
          
          <div className="space-y-8 text-[#54656f]">
            <div>
              <h3 className="text-xl font-bold text-[#111] mb-3 border-b border-[#e9edef] pb-2">Public Landing Page</h3>
              <p className="mb-2">The marketing face of the platform. Sections include Hero, Why Join Us, Subjects, About, and Contact.</p>
              <p className="text-sm font-medium text-[#1099A1] bg-[#f0faf0] inline-block px-3 py-1 rounded-md">Built statically for high performance (No CMS included in Base MVP).</p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#111] mb-3 border-b border-[#e9edef] pb-2">Student Portal</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Dashboard:</strong> Welcome banner, next session countdown, and homework assignments.</li>
                <li><strong>Course Catalog:</strong> Browse available courses and check tutor availability.</li>
                <li><strong>Messages:</strong> Basic asynchronous text messaging (similar to an inbox). <em>Note: Real-time live chat is out of scope for Base MVP.</em></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#111] mb-3 border-b border-[#e9edef] pb-2">Tutor Portal</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Availability Editor:</strong> A weekly grid where tutors can paint their availability.</li>
                <li><strong>Session Management:</strong> Start meetings and mark sessions complete.</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-[#111] mb-3 border-b border-[#e9edef] pb-2">Admin Portal</h3>
              <p>Basic platform management tools including User Management (approving/rejecting tutors) and manual session oversight.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Authentication */}
        <section 
          id="auth" 
          ref={el => sectionRefs.current['auth'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Key size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">3. Authentication Method</h2>
            </div>
            {choices.auth && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">How will users create accounts and log into the system?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectionCard 
              title="Email & Password"
              description="Standard login method. Lowest development effort and zero ongoing costs."
              costBreakdown={OPTION_PRICES["Email & Password"]}
              selected={choices.auth === "Email & Password"}
              onClick={() => updateChoice("auth", "Email & Password")}
            />
            <SelectionCard 
              title="Social Login (Google)"
              description="Users can 'Continue with Google'. Requires setting up Google Cloud OAuth."
              costBreakdown={OPTION_PRICES["Social Login"]}
              selected={choices.auth === "Social Login"}
              onClick={() => updateChoice("auth", "Social Login")}
            />
            <SelectionCard 
              title="Phone Number (OTP)"
              description="Requires integrating an SMS Gateway (e.g., AfroMessage). Incurs ongoing costs per SMS."
              costBreakdown={OPTION_PRICES["Phone Number OTP"]}
              selected={choices.auth === "Phone Number OTP"}
              onClick={() => updateChoice("auth", "Phone Number OTP")}
            />
          </div>
        </section>

        {/* Section 4: Onboarding */}
        <section 
          id="onboarding" 
          ref={el => sectionRefs.current['onboarding'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Users size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">4. Who can be tutor</h2>
            </div>
            {choices.onboarding && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">How do tutors join the platform and start accepting students? This determines the quality control mechanisms we need to build into the Admin dashboard.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="Anyone can be tutor"
              description="Anyone can sign up and start teaching immediately. Lowest barrier to entry, but requires building automated KYC."
              costBreakdown={OPTION_PRICES["Anyone can be tutor"]}
              selected={choices.onboarding === "Anyone can be tutor"}
              onClick={() => updateChoice("onboarding", "Anyone can be tutor")}
            />
            <SelectionCard 
              title="Limited / Fixed Tutors (Selected)"
              description="An Admin must manually review credentials and click 'Approve' in a dedicated Admin review dashboard."
              costBreakdown={OPTION_PRICES["Limited / Fixed Tutors (Selected)"]}
              selected={choices.onboarding === "Limited / Fixed Tutors (Selected)"}
              onClick={() => updateChoice("onboarding", "Limited / Fixed Tutors (Selected)")}
            />
          </div>
        </section>

        {/* Section 5: Course Creation */}
        <section 
          id="courses" 
          ref={el => sectionRefs.current['courses'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Code2 size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">5. Course Creation</h2>
            </div>
            {choices.courses && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">Who is responsible for defining the courses taught on the platform?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="Fixed Courses (Admin Created)"
              description="Admins create a strict, fixed list of official courses. Tutors can only select from this pre-approved list."
              costBreakdown={OPTION_PRICES["Fixed Courses"]}
              selected={choices.courses === "Fixed Courses"}
              onClick={() => updateChoice("courses", "Fixed Courses")}
            />
            <SelectionCard 
              title="Tutor-Driven Marketplace"
              description="Tutors have the freedom to create, name, and publish their own unique courses with custom syllabuses."
              costBreakdown={OPTION_PRICES["Tutor-Driven Marketplace"]}
              selected={choices.courses === "Tutor-Driven Marketplace"}
              onClick={() => updateChoice("courses", "Tutor-Driven Marketplace")}
            />
          </div>
        </section>

        {/* Section 6: Session Booking */}
        <section 
          id="booking" 
          ref={el => sectionRefs.current['booking'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <CalendarClock size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">6. Session Booking Flow</h2>
            </div>
            {choices.booking && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">How do students actually book a tutor?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="Scheduled Calendar Booking"
              description="Students browse a calendar UI, pick an open time slot, and book it for the future."
              costBreakdown={OPTION_PRICES["Scheduled Calendar Booking"]}
              selected={choices.booking === "Scheduled Calendar Booking"}
              onClick={() => updateChoice("booking", "Scheduled Calendar Booking")}
            />
            <SelectionCard 
              title="On-Demand / Instant Match"
              description="Like Uber. Extreme development effort. Requires complex real-time matchmaking state."
              costBreakdown={OPTION_PRICES["On-Demand / Instant Match"]}
              selected={choices.booking === "On-Demand / Instant Match"}
              onClick={() => updateChoice("booking", "On-Demand / Instant Match")}
            />
          </div>
        </section>

        {/* Section 7: Payment */}
        <section 
          id="payment" 
          ref={el => sectionRefs.current['payment'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <CreditCard size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">7. Payment Strategy</h2>
            </div>
            {choices.paymentMode && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">
            The monetization strategy directly impacts the complexity of the platform. More complex payment flows (like escrow or split payouts) require significantly more development time.
          </p>

          <h3 className="font-bold text-[#111] mb-4 text-lg">A. Monetization Model</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <SelectionCard 
              title="Course-based"
              description="Students purchase an entire course package upfront."
              costBreakdown={OPTION_PRICES["Course-based"]}
              selected={choices.paymentMode === "Course-based"}
              onClick={() => updateChoice("paymentMode", "Course-based")}
            />
            <SelectionCard 
              title="Subscription"
              description="Students pay a fixed monthly fee for access. Requires recurring billing webhooks."
              costBreakdown={OPTION_PRICES["Subscription"]}
              selected={choices.paymentMode === "Subscription"}
              onClick={() => updateChoice("paymentMode", "Subscription")}
            />
            <SelectionCard 
              title="Pay-per-Session"
              description="Requires escrow logic, fractional accounting, complex refund handling, and split payout APIs."
              costBreakdown={OPTION_PRICES["Pay-per-Session"]}
              selected={choices.paymentMode === "Pay-per-Session"}
              onClick={() => updateChoice("paymentMode", "Pay-per-Session")}
            />
          </div>

          <h3 className="font-bold text-[#111] mb-4 text-lg">B. Payment Gateways <span className="font-normal text-sm text-[#54656f]">(1st is Free, +$15 Dev Cost per additional)</span></h3>
          <div className="flex flex-wrap gap-3">
            {["Stripe (International)", "PayPal (International)", "ArifPay (Local ETB)", "Chapa (Local ETB)", "Telebirr (Local ETB)", "Manual Bank Transfer"].map(gateway => (
              <button
                key={gateway}
                onClick={() => toggleGateway(gateway)}
                className={cn(
                  "px-4 py-2 border rounded-md text-sm font-medium transition-colors",
                  choices.gateways.includes(gateway)
                    ? "bg-[#1099A1] border-[#1099A1] text-white"
                    : "bg-white border-[#e9edef] text-[#54656f] hover:border-[#1099A1]"
                )}
              >
                {gateway} {choices.gateways.includes(gateway) && <Check size={14} className="inline ml-1"/>}
              </button>
            ))}
          </div>
        </section>

        {/* Section 8: Commission */}
        <section 
          id="commission" 
          ref={el => sectionRefs.current['commission'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <PieChart size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">8. Revenue Split (Commission)</h2>
            </div>
            {choices.commission && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">How does the platform make money from tutors? Automated percentage splits require advanced payment APIs.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="Flat Subscription Fee"
              description="Tutors pay a flat monthly fee to be listed. They keep 100% of their earnings."
              costBreakdown={OPTION_PRICES["Flat Subscription Fee"]}
              selected={choices.commission === "Flat Subscription Fee"}
              onClick={() => updateChoice("commission", "Flat Subscription Fee")}
            />
            <SelectionCard 
              title="Automated Percentage Split"
              description="Platform automatically deducts a percentage from every session booked. Requires Stripe Connect."
              costBreakdown={OPTION_PRICES["Automated Percentage Split"]}
              selected={choices.commission === "Automated Percentage Split"}
              onClick={() => updateChoice("commission", "Automated Percentage Split")}
            />
          </div>
        </section>

        {/* Section 9: Video Conferencing */}
        <section 
          id="video" 
          ref={el => sectionRefs.current['video'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Video size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">9. Video Conferencing</h2>
            </div>
            {choices.video && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">A critical decision is how online tutoring sessions are hosted.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SelectionCard title="External Links" description="Google Meet, Zoom, Teams links pasted by tutors." costBreakdown={OPTION_PRICES["External Links"]} selected={choices.video === "External Links"} onClick={() => updateChoice("video", "External Links")} />
            <SelectionCard title="Jitsi Meet" description="Embedded free Jitsi iframe." costBreakdown={OPTION_PRICES["Jitsi Meet"]} selected={choices.video === "Jitsi Meet"} onClick={() => updateChoice("video", "Jitsi Meet")} />
            <SelectionCard title="Zoom SDK" description="Embedded Zoom with API integration." costBreakdown={OPTION_PRICES["Zoom SDK"]} selected={choices.video === "Zoom SDK"} onClick={() => updateChoice("video", "Zoom SDK")} />
            <SelectionCard title="Self-Hosted" description="Dedicated BigBlueButton servers." costBreakdown={OPTION_PRICES["Self-Hosted"]} selected={choices.video === "Self-Hosted"} onClick={() => updateChoice("video", "Self-Hosted")} />
          </div>
        </section>

        {/* Section 10: Recordings */}
        <section 
          id="recordings" 
          ref={el => sectionRefs.current['recordings'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Film size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">10. Session Recordings</h2>
            </div>
            {choices.recordings && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <p className="text-[#54656f] mb-6">How are session video recordings handled and stored for students to review later?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectionCard 
              title="No Recordings"
              description="Sessions are live only. No recordings are saved or provided."
              costBreakdown={OPTION_PRICES["No Recordings"]}
              selected={choices.recordings === "No Recordings"}
              onClick={() => updateChoice("recordings", "No Recordings")}
            />
            <SelectionCard 
              title="Manual Link Pasting"
              description="Tutors record to their own Google Drive, then paste the video URL into the session notes."
              costBreakdown={OPTION_PRICES["Manual Link Pasting"]}
              selected={choices.recordings === "Manual Link Pasting"}
              onClick={() => updateChoice("recordings", "Manual Link Pasting")}
            />
            <SelectionCard 
              title="Automated Cloud Sync"
              description="Zoom APIs automatically fetch and embed the cloud recording into the student portal."
              costBreakdown={OPTION_PRICES["Automated Cloud Sync"]}
              selected={choices.recordings === "Automated Cloud Sync"}
              onClick={() => updateChoice("recordings", "Automated Cloud Sync")}
            />
          </div>
        </section>

        {/* Section 11: Reviews */}
        <section 
          id="reviews" 
          ref={el => sectionRefs.current['reviews'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Star size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">11. Review & Rating System</h2>
            </div>
            {choices.reviews && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectionCard 
              title="No Reviews"
              description="Tutor quality is assessed entirely by Admins."
              costBreakdown={OPTION_PRICES["No Reviews"]}
              selected={choices.reviews === "No Reviews"}
              onClick={() => updateChoice("reviews", "No Reviews")}
            />
            <SelectionCard 
              title="Auto-Published Ratings"
              description="Students leave a 1-5 star rating and review that appears instantly."
              costBreakdown={OPTION_PRICES["Auto-Published Ratings"]}
              selected={choices.reviews === "Auto-Published Ratings"}
              onClick={() => updateChoice("reviews", "Auto-Published Ratings")}
            />
            <SelectionCard 
              title="Admin-Moderated"
              description="Reviews go to an Admin dashboard queue first for approval."
              costBreakdown={OPTION_PRICES["Admin-Moderated"]}
              selected={choices.reviews === "Admin-Moderated"}
              onClick={() => updateChoice("reviews", "Admin-Moderated")}
            />
          </div>
        </section>

        {/* Section 12: Customer Support */}
        <section 
          id="support" 
          ref={el => sectionRefs.current['support'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <HelpCircle size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">12. Customer Support</h2>
            </div>
            {choices.support && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectionCard 
              title="Email Only"
              description="A simple 'Contact Us' form."
              costBreakdown={OPTION_PRICES["Email Only"]}
              selected={choices.support === "Email Only"}
              onClick={() => updateChoice("support", "Email Only")}
            />
            <SelectionCard 
              title="Embedded Chat Widget"
              description="Embed a third-party chat tool (like Intercom)."
              costBreakdown={OPTION_PRICES["Embedded Chat Widget"]}
              selected={choices.support === "Embedded Chat Widget"}
              onClick={() => updateChoice("support", "Embedded Chat Widget")}
            />
            <SelectionCard 
              title="Custom Ticket System"
              description="Build an internal ticketing system where users can view and track their complaints."
              costBreakdown={OPTION_PRICES["Custom Ticket System"]}
              selected={choices.support === "Custom Ticket System"}
              onClick={() => updateChoice("support", "Custom Ticket System")}
            />
          </div>
        </section>

        {/* Section 13: Localization */}
        <section 
          id="language" 
          ref={el => sectionRefs.current['language'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Languages size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">13. Localization (Languages)</h2>
            </div>
            {choices.language && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="English Only"
              description="The entire platform is built exclusively in English."
              costBreakdown={OPTION_PRICES["English Only"]}
              selected={choices.language === "English Only"}
              onClick={() => updateChoice("language", "English Only")}
            />
            <SelectionCard 
              title="Bilingual (English + Amharic)"
              description="Users can toggle between English and Amharic. Requires manual translations."
              costBreakdown={OPTION_PRICES["Bilingual (English + Amharic)"]}
              selected={choices.language === "Bilingual (English + Amharic)"}
              onClick={() => updateChoice("language", "Bilingual (English + Amharic)")}
            />
          </div>
        </section>

        {/* Section 14: Notifications */}
        <section 
          id="notifications" 
          ref={el => sectionRefs.current['notifications'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Bell size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">14. Notification Strategy</h2>
            </div>
            {choices.notifications && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectionCard 
              title="In-App Only"
              description="Alerts only show up inside the website."
              costBreakdown={OPTION_PRICES["In-App Only"]}
              selected={choices.notifications === "In-App Only"}
              onClick={() => updateChoice("notifications", "In-App Only")}
            />
            <SelectionCard 
              title="Email Alerts"
              description="Sends emails for important events."
              costBreakdown={OPTION_PRICES["Email Alerts"]}
              selected={choices.notifications === "Email Alerts"}
              onClick={() => updateChoice("notifications", "Email Alerts")}
            />
            <SelectionCard 
              title="Push / SMS Alerts"
              description="Real browser push notifications or SMS texts."
              costBreakdown={OPTION_PRICES["Push / SMS Alerts"]}
              selected={choices.notifications === "Push / SMS Alerts"}
              onClick={() => updateChoice("notifications", "Push / SMS Alerts")}
            />
          </div>
        </section>

        {/* Section 15: Admin Analytics */}
        <section 
          id="analytics" 
          ref={el => sectionRefs.current['analytics'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <BarChart size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">15. Admin Analytics Dashboard</h2>
            </div>
            {choices.analytics && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="Basic Counters"
              description="Simple text numbers (e.g., 'Total Revenue: $500')."
              costBreakdown={OPTION_PRICES["Basic Counters"]}
              selected={choices.analytics === "Basic Counters"}
              onClick={() => updateChoice("analytics", "Basic Counters")}
            />
            <SelectionCard 
              title="Advanced Graphical Dashboard"
              description="Interactive charts, line graphs, and CSV exports."
              costBreakdown={OPTION_PRICES["Advanced Graphical Dashboard"]}
              selected={choices.analytics === "Advanced Graphical Dashboard"}
              onClick={() => updateChoice("analytics", "Advanced Graphical Dashboard")}
            />
          </div>
        </section>

        {/* Section 16: Refund Policy */}
        <section 
          id="refunds" 
          ref={el => sectionRefs.current['refunds'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">16. Refund Policy Engine</h2>
            </div>
            {choices.refunds && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionCard 
              title="Manual Refunds (Admin handled)"
              description="The Admin manually logs into Stripe/Chapa to issue the refund."
              costBreakdown={OPTION_PRICES["Manual Refunds (Admin handled)"]}
              selected={choices.refunds === "Manual Refunds (Admin handled)"}
              onClick={() => updateChoice("refunds", "Manual Refunds (Admin handled)")}
            />
            <SelectionCard 
              title="Automated Dispute System"
              description="Tutor is notified. Payouts are frozen automatically while an admin reviews."
              costBreakdown={OPTION_PRICES["Automated Dispute System"]}
              selected={choices.refunds === "Automated Dispute System"}
              onClick={() => updateChoice("refunds", "Automated Dispute System")}
            />
          </div>
        </section>

        {/* Section 17: Infrastructure */}
        <section 
          id="infrastructure" 
          ref={el => sectionRefs.current['infrastructure'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
           <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Server size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">17. Infrastructure</h2>
            </div>
            {choices.infrastructure && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectionCard 
              title="Serverless" 
              description="Zero DevOps overhead. Highly scalable. (Vercel & Supabase)" 
              costBreakdown={OPTION_PRICES["Serverless"]}
              selected={choices.infrastructure === "Serverless"} 
              onClick={() => updateChoice("infrastructure", "Serverless")} 
            />
            <SelectionCard 
              title="VPS" 
              description="Fixed cost virtual machines. Requires manual security updates." 
              costBreakdown={OPTION_PRICES["VPS"]}
              selected={choices.infrastructure === "VPS"} 
              onClick={() => updateChoice("infrastructure", "VPS")} 
            />
            <SelectionCard 
              title="Local Cloud (Ethiopia)" 
              description="Local data hosting. High setup and maintenance effort." 
              costBreakdown={OPTION_PRICES["Local Cloud (Ethiopia)"]}
              selected={choices.infrastructure === "Local Cloud (Ethiopia)"} 
              onClick={() => updateChoice("infrastructure", "Local Cloud (Ethiopia)")} 
            />
          </div>
        </section>

        {/* Section 18: Domain Options */}
        <section 
          id="domain" 
          ref={el => sectionRefs.current['domain'] = el}
          className="mb-16 scroll-mt-10 bg-white p-8 rounded-xl shadow-sm border border-[#e9edef]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-[#f0faf0] text-[#1099A1] rounded-xl">
                <Globe size={24} />
              </div>
              <h2 className="text-3xl font-bold text-[#111]">18. Domain & Branding</h2>
            </div>
            {choices.domainExt && <span className="bg-[#1099A1] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1"><Check size={14}/> Selected</span>}
          </div>
          
          <div className="bg-[#fff0f0] p-4 rounded-lg border border-[#fcd5d5] mb-6">
            <h4 className="font-semibold text-red-600 flex items-center gap-2 mb-2">
              <AlertCircle size={18} /> yakal.com is Unavailable
            </h4>
            <p className="text-sm text-red-800">
              According to Namecheap data, <strong>yakal.com</strong> is currently taken. We must select an alternative extension.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SelectionCard title="yakal.org" description="" costBreakdown={OPTION_PRICES["yakal.org"]} selected={choices.domainExt === "yakal.org"} onClick={() => updateChoice("domainExt", "yakal.org")} />
            <SelectionCard title="yakal.net" description="" costBreakdown={OPTION_PRICES["yakal.net"]} selected={choices.domainExt === "yakal.net"} onClick={() => updateChoice("domainExt", "yakal.net")} />
            <SelectionCard title="yakal.ai" description="" costBreakdown={OPTION_PRICES["yakal.ai"]} selected={choices.domainExt === "yakal.ai"} onClick={() => updateChoice("domainExt", "yakal.ai")} />
            <SelectionCard title="Local (.et / .edu.et)" description="Ethiopian registry." costBreakdown={OPTION_PRICES["Local (.et)"]} selected={choices.domainExt === "Local (.et)"} onClick={() => updateChoice("domainExt", "Local (.et)")} />
          </div>
        </section>

        {/* Section 19: Final Summary */}
        <section 
          id="summary" 
          ref={el => sectionRefs.current['summary'] = el}
          className="mb-16 scroll-mt-10 bg-[#f8f9fa] p-8 rounded-xl border border-[#e9edef]"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center p-3 bg-[#1099A1] text-white rounded-xl">
              <CheckSquare size={24} />
            </div>
            <h2 className="text-3xl font-bold text-[#111]">Final Scope Summary</h2>
          </div>
          
          <p className="text-[#54656f] mb-6">
            Based on your selections, this is the generated scope document. You can copy this and send it to the development team as the final PRD/Contract.
          </p>

          <div className="relative">
            <pre className="bg-white p-6 rounded-lg border border-[#e9edef] text-sm text-[#111] whitespace-pre-wrap font-mono shadow-inner max-h-[500px] overflow-y-auto">
              {generateContractText()}
            </pre>
            <button 
              onClick={handleCopy}
              className="absolute top-4 right-4 bg-[#1099A1] hover:bg-[#0e868d] text-white px-4 py-2 rounded-md font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <Copy size={16} /> Copy to Clipboard
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}

// Helper Component for Selectable Cards
function SelectionCard({ 
  title, 
  description, 
  costBreakdown, 
  selected, 
  onClick 
}: { 
  title: string, 
  description: string, 
  costBreakdown?: CostBreakdown, 
  selected: boolean, 
  onClick: () => void 
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 h-full flex flex-col",
        selected 
          ? "border-[#1099A1] bg-[#f0faf0] shadow-sm" 
          : "border-[#e9edef] bg-white hover:border-[#97CE9D]"
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-[#111] pr-4">{title}</h4>
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
          selected ? "border-[#1099A1] bg-[#1099A1]" : "border-[#aebac1]"
        )}>
          {selected && <Check size={12} className="text-white" />}
        </div>
      </div>
      
      {description && <p className="text-sm text-[#54656f] leading-snug flex-grow">{description}</p>}
      
      {costBreakdown && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[#e9edef] pt-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#54656f] font-medium">Dev Fee:</span>
            <span className={cn(
              "font-semibold px-2 py-0.5 rounded",
              selected ? "bg-[#1099A1]/10 text-[#1099A1]" : "bg-[#f8f9fa] text-[#54656f]"
            )}>
              {costBreakdown.devCost === 0 ? "Included" : `+$${costBreakdown.devCost}`}
            </span>
          </div>

          {costBreakdown.recurringText && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#54656f] font-medium flex items-center gap-1"><Repeat size={10} /> SaaS Cost:</span>
              <span className="font-semibold text-orange-600">
                {costBreakdown.recurringText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
