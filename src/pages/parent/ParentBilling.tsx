import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { CreditCard, FileText, ExternalLink, Download, Plus, BarChart2, Clock, ChevronDown, ChevronUp, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

// Brand-only palette (teal + gold + supporting warm/greens).
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ParentBilling() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState("pm_1");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [saveCard, setSaveCard] = useState(true);

  const paymentMethods = [
    { id: "pm_1", type: "CREDIT_CARD", name: "*****4242", expiry: "Expires 12/28" },
    { id: "pm_2", type: "PAYPAL", name: "PayPal" },
  ];

  const upcomingInvoices = [
    { id: "INV-2026-001", description: "Fall Semester - AP Physics (Brooklyn)", amount: 450.00, dueDate: "Nov 15, 2026", status: "unpaid" },
    { id: "INV-2026-002", description: "Algebra II Mentorship (Austin)", amount: 200.00, dueDate: "Nov 20, 2026", status: "unpaid" },
  ];

  const pastInvoices = [
    { id: "INV-2026-000", description: "Registration Fee", amount: 50.00, date: "Sep 28, 2026", status: "paid" },
    { id: "INV-2025-089", description: "Summer Bootcamp (Brooklyn)", amount: 300.00, date: "Jun 01, 2026", status: "paid" },
  ];

  const totalDue = upcomingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const chartData = [
    { month: "Aug", sessions: 4 },
    { month: "Sep", sessions: 8 },
    { month: "Oct", sessions: 6 },
    { month: "Nov", sessions: 3 }, // Current month partial
  ];

  const handlePayNow = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      // Simulate redirect to Stripe checkout
      window.open("https://stripe.com", "_blank");
    }, 1000);
  };

  const handleCustomerPortal = () => {
    // Simulate redirect to Stripe Customer Portal
    window.open("https://stripe.com", "_blank");
  };

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white pt-6 md:pt-10 px-6 md:px-10 pb-0 md:pb-0 relative overflow-hidden shrink-0">
          {/* Subtle Background Texture/Graph */}
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/20 pb-8">
            <div className="space-y-1">
              <h1 className="text-white/80 text-[14px] font-medium uppercase tracking-wider mb-2">Total Balance Due</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-4xl md:text-5xl font-bold tracking-tight">{money(totalDue)}</span>
              </div>
              <p className="text-white/70 text-[14px] pt-1">
                Next payment due on <span className="font-bold text-white">Nov 15, 2026</span>
              </p>
            </div>

          </div>
        </div>

        {/* Content Below Banner */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10 flex flex-col lg:flex-row gap-12 lg:gap-16">

          {/* Left Column: All Transactions */}
          <div className="flex-1 min-w-0 space-y-8">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Transactions</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">Recent billing activity</p>
              </div>
              <Button onClick={handlePayNow} disabled={isProcessing || totalDue <= 0} style={{ backgroundColor: '#CAA25F', color: 'white' }} className="h-9 px-4 font-bold border-0 hover:opacity-90 transition-opacity rounded shadow-sm text-[13px]">
                {isProcessing ? "Processing..." : `Pay ${money(totalDue)}`}
              </Button>
            </div>

            <div className="flex flex-col space-y-0">
              {/* Upcoming Invoices */}
              {upcomingInvoices.map((inv) => (
                <div key={inv.id} className="group flex items-center justify-between py-4 border-b border-border/40 px-2 -mx-2 hover:bg-muted/10 transition-colors cursor-default">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center text-amber-600 dark:text-amber-400">
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[14px] md:text-[15px] text-foreground truncate">{inv.description}</p>
                      <p className="text-[12px] md:text-[13px] text-muted-foreground mt-0.5">Due: {inv.dueDate} • {inv.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 pl-2">
                    <span className="text-[14px] md:text-[15px] font-semibold text-foreground">{money(inv.amount)}</span>
                    <Button size="sm" onClick={handlePayNow} className="h-8 px-3 text-[12px] bg-[#1099A1] hover:bg-[#0d848b] text-white hidden sm:flex">Pay</Button>
                  </div>
                </div>
              ))}

              {/* Past Invoices */}
              {pastInvoices.map((inv) => (
                <div key={inv.id} className="group flex items-center justify-between py-4 border-b border-border/40 last:border-0 px-2 -mx-2 hover:bg-muted/10 transition-colors cursor-default">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-[#97CE9D]/20 items-center justify-center text-[#7d8f69]">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[14px] md:text-[15px] text-foreground truncate">{inv.description}</p>
                      <p className="text-[12px] md:text-[13px] text-muted-foreground mt-0.5">{inv.date} • {inv.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 pl-2">
                    <span className="text-[14px] md:text-[15px] font-semibold text-muted-foreground">{money(inv.amount)}</span>
                    <button className="text-muted-foreground hover:text-[#1099A1] transition-colors p-2 hidden sm:block" title="Download Receipt">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Payment Methods */}
          <div className="w-full lg:w-[380px] shrink-0 space-y-6">
            <div className="mb-2">
              <h3 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment Method</h3>

              {/* Selectable Payment Methods List */}
              <div className="border border-border/60 bg-white dark:bg-[#111b21]">
                {paymentMethods.map((method, index) => (
                  <div key={method.id}
                    className={`flex flex-col border-b border-border/60 last:border-0 transition-colors ${selectedMethodId === method.id ? 'bg-muted/10' : ''}`}
                  >
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => setSelectedMethodId(method.id)}
                    >
                      <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full border-2 border-[#1099A1]">
                        {selectedMethodId === method.id && <div className="w-2.5 h-2.5 rounded-full bg-[#1099A1]"></div>}
                      </div>

                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <p className="text-[15px] font-semibold text-foreground">{method.name}</p>
                          {method.expiry && <p className="text-[13px] text-muted-foreground mt-0.5">{method.expiry}</p>}
                        </div>

                        <div className="flex items-center gap-1.5 opacity-80">
                          <div className="w-8 h-5 border border-border/60 rounded-[2px] flex items-center justify-center bg-white"><span className="text-[#1434CB] text-[8px] font-bold italic">VISA</span></div>
                          <div className="w-8 h-5 border border-border/60 rounded-[2px] flex items-center justify-center bg-white"><span className="text-[#FF5F00] text-[8px] font-bold">MC</span></div>
                          <div className="w-8 h-5 border border-border/60 rounded-[2px] flex items-center justify-center bg-[#016FD0]"><span className="text-white text-[8px] font-bold">AMEX</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Extra details when selected */}
                    {selectedMethodId === method.id && method.type === "PAYPAL" && (
                      <div className="pl-[3.25rem] pb-4 pr-4">
                        <label className="flex items-center gap-2 cursor-pointer" onClick={() => setSaveCard(!saveCard)}>
                          <div
                            className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center bg-transparent ${saveCard ? 'border-primary bg-primary' : 'border-border/60'}`}
                          >
                            {saveCard && <CheckIcon size={12} strokeWidth={3} className="text-primary" />}
                          </div>
                          <span role="button" className={`text-[13px] select-none ${saveCard ? 'text-primary' : 'text-muted-foreground'}`}>Save this PayPal account for future transactions</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add Payment Method Accordion */}
            <div className="border border-border/60 bg-white dark:bg-[#111b21] mb-2">
              <button
                onClick={() => setIsAddingCard(!isAddingCard)}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#111b21] hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center gap-2 font-medium text-[15px] text-foreground">
                  <CreditCard size={18} className="text-muted-foreground" />
                  Add New Card
                </div>
                {isAddingCard ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
              </button>

              {isAddingCard && (
                <div className="p-4 pt-0 border-t border-border/60 bg-white dark:bg-[#111b21]">
                  <div className="space-y-4 pt-4">
                    <input
                      type="text"
                      placeholder="Card Holder Name"
                      className="w-full border border-border/60 p-3 text-[14px] focus:outline-none focus:border-[#97CE9D] focus:ring-1 focus:ring-[#97CE9D] bg-transparent"
                    />

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Card Number"
                        className="w-full border border-border/60 p-3 text-[14px] pr-20 focus:outline-none focus:border-[#97CE9D] focus:ring-1 focus:ring-[#97CE9D] bg-transparent"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 opacity-50">
                        <div className="w-7 h-4 bg-[#1434CB] rounded-[2px] flex items-center justify-center"><span className="text-white text-[7px] font-bold">VISA</span></div>
                        <div className="w-7 h-4 bg-[#FF5F00] rounded-[2px] flex items-center justify-center"><span className="text-white text-[7px] font-bold">MC</span></div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        className="w-1/2 border border-border/60 p-3 text-[14px] focus:outline-none focus:border-[#97CE9D] focus:ring-1 focus:ring-[#97CE9D] bg-transparent"
                      />
                      <input
                        type="text"
                        placeholder="CVC"
                        className="w-1/2 border border-border/60 p-3 text-[14px] focus:outline-none focus:border-[#97CE9D] focus:ring-1 focus:ring-[#97CE9D] bg-transparent"
                      />
                    </div>

                    <label className="flex items-center gap-2 mt-4 cursor-pointer ml-1">
                      <div
                        className={`w-4 h-4 border-2 flex items-center justify-center bg-transparent transition-colors ${saveCard ? 'border-[#97CE9D] bg-[#97CE9D]' : 'border-border/60 dark:border-white'}`}
                        onClick={() => setSaveCard(!saveCard)}
                      >
                        {saveCard && <CheckIcon size={12} strokeWidth={3} className="text-[#97CE9D]" />}
                      </div>
                      <span className={`text-[13px] ${saveCard ? 'text-[#97CE9D] font-medium' : 'text-muted-foreground'}`}>Save my card for faster checkout</span>
                    </label>

                    <Button className="w-full mt-4 h-12 font-bold tracking-wider uppercase text-[13px] !text-white rounded-none transition-colors border-0" style={{ backgroundColor: '#97CE9D', color: '#000' }}>
                      Add Payment Method
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleCustomerPortal} className="w-full flex items-center justify-center gap-2 font-medium text-[13px] h-12 rounded-none border-border/60 hover:bg-muted/10 text-foreground transition-colors">
              Manage in Stripe <ExternalLink size={14} />
            </Button>

            {/* Sessions Graph */}
            <div className="bg-transparent mt-8">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[14px] font-semibold text-foreground">Learning Activity</h3>
                <BarChart2 size={16} className="text-muted-foreground" />
              </div>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1099A1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1099A1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={5} />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-[#202c33] border border-border shadow-sm px-3 py-2 rounded text-[12px]">
                              <span className="font-semibold text-[#111] dark:text-white">{payload[0].value} sessions</span>
                            </div>
                          )
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="sessions" stroke="#1099A1" strokeWidth={3} fillOpacity={1} fill="url(#colorSessions)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
