import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminUser, getAdminUserDetails, UserDetails } from "@/services/adminService";
import { Button } from "@/components/ui/Button";
import { X, Loader2, Calendar, FileText, Users, DollarSign, BookOpen, GraduationCap } from "lucide-react";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { format } from "date-fns";
import { dicebearUrl } from "@/utils/avatar";

interface AdminUserViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

export function AdminUserViewModal({ isOpen, onClose, user }: AdminUserViewModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: details, isLoading } = useQuery({
    queryKey: ["admin-user-details", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await getAdminUserDetails(user.id, user.role);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: isOpen && !!user,
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab("overview");
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const renderTabs = () => {
    const tabs = [{ id: "overview", label: "Overview", icon: FileText }];
    
    if (user.role === "parent") {
      tabs.push({ id: "children", label: "Children", icon: Users });
      tabs.push({ id: "invoices", label: "Payment History", icon: DollarSign });
    } else if (user.role === "student") {
      tabs.push({ id: "sessions", label: "Sessions", icon: Calendar });
      tabs.push({ id: "admissions", label: "Admissions", icon: GraduationCap });
      tabs.push({ id: "services", label: "Services", icon: BookOpen });
    } else if (user.role === "tutor") {
      tabs.push({ id: "students", label: "Students", icon: Users });
      tabs.push({ id: "sessions", label: "Sessions", icon: Calendar });
      tabs.push({ id: "courses", label: "Courses", icon: BookOpen });
      tabs.push({ id: "invoices", label: "Payouts", icon: DollarSign });
    } else if (user.role === "counselor") {
      tabs.push({ id: "students", label: "Students", icon: Users });
      tabs.push({ id: "sessions", label: "Sessions", icon: Calendar });
      tabs.push({ id: "invoices", label: "Payouts", icon: DollarSign });
    }

    return (
      <div className="flex overflow-x-auto gap-2 p-4 border-b border-[#e9edef] dark:border-[#2a3942] custom-scrollbar shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors",
              activeTab === t.id
                ? "bg-[#1099A1] text-white"
                : "bg-gray-100 dark:bg-[#182329] text-muted-foreground hover:bg-gray-200 dark:hover:bg-[#202c33]"
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#1099A1]" />
          <p className="mt-4 text-[13px] text-muted-foreground">Loading user details...</p>
        </div>
      );
    }

    if (!details) return null;

    if (activeTab === "overview") {
      return (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-gray-50 dark:bg-[#182329] p-5 rounded-xl border border-[#e9edef] dark:border-[#2a3942] flex items-center gap-4">
            <img 
              src={details.profile.avatar_url || dicebearUrl(details.profile.full_name)} 
              alt={details.profile.full_name} 
              className="w-16 h-16 rounded-full border-2 border-white dark:border-[#202c33] shadow-sm"
            />
            <div>
              <h3 className="text-lg font-bold text-[#111] dark:text-white">{details.profile.full_name}</h3>
              <p className="text-[13px] text-muted-foreground">{details.profile.email || "No email"}</p>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-[#202c33] text-[11px] font-semibold uppercase">{details.profile.role}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold uppercase">{details.profile.status}</span>
              </div>
            </div>
          </div>

          {(user.role === "tutor" || user.role === "counselor") && (
            <div className="space-y-4">
              <div>
                <h4 className="text-[14px] font-bold text-[#111] dark:text-white mb-2">Bio</h4>
                <div className="bg-gray-50 dark:bg-[#182329] p-4 rounded-xl border border-[#e9edef] dark:border-[#2a3942] text-[13px] text-muted-foreground whitespace-pre-wrap">
                  {details.profile.bio || "No bio provided."}
                </div>
              </div>
              {details.profile.cv_url && (
                <div>
                  <h4 className="text-[14px] font-bold text-[#111] dark:text-white mb-2">Resume / CV</h4>
                  <a 
                    href={details.profile.cv_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1099A1]/10 text-[#1099A1] hover:bg-[#1099A1]/20 rounded-lg text-[13px] font-semibold transition-colors"
                  >
                    <FileText size={16} /> View Document
                  </a>
                </div>
              )}
            </div>
          )}
          
          <div className="text-[12px] text-muted-foreground text-right mt-4">
            Joined: {format(new Date(details.profile.created_at), "MMM d, yyyy")}
          </div>
        </div>
      );
    }

    if (activeTab === "invoices") {
      const invoices = details.invoices || [];
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h4 className="text-[14px] font-bold text-[#111] dark:text-white">{user.role === "parent" ? "Payment History" : "Payouts"}</h4>
          {invoices.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No invoices found.</p>
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="p-4 flex items-center justify-between bg-white dark:bg-[#111b21]">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111] dark:text-white">{inv.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(inv.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-[#111] dark:text-white">{money(user.role === "parent" ? inv.amount_cents : inv.payout_cents)}</p>
                    <p className={cn("text-[11px] font-semibold uppercase mt-1", 
                      (user.role === "parent" ? inv.status : inv.payout_status) === "paid" ? "text-emerald-500" : "text-amber-500"
                    )}>
                      {user.role === "parent" ? inv.status : inv.payout_status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "children" || activeTab === "students") {
      const list = activeTab === "children" ? details.children : details.students;
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h4 className="text-[14px] font-bold text-[#111] dark:text-white capitalize">{activeTab}</h4>
          {(!list || list.length === 0) ? (
            <p className="text-[13px] text-muted-foreground">No {activeTab} found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {list.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
                  <img src={s.avatar_url || dicebearUrl(s.full_name)} alt={s.full_name} className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="text-[13px] font-bold text-[#111] dark:text-white">{s.full_name}</p>
                    {s.grade_level && <p className="text-[11px] text-muted-foreground">{s.grade_level}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "sessions") {
      const sessions = details.sessions || [];
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h4 className="text-[14px] font-bold text-[#111] dark:text-white">Sessions</h4>
          {sessions.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No sessions found.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s: any) => (
                <div key={s.id} className="p-3 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111] dark:text-white">{s.title || "Untitled Session"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {s.start_time ? format(new Date(s.start_time), "MMM d, h:mm a") : "No date set"}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-md uppercase",
                    s.status === "completed" ? "bg-emerald-100 text-emerald-700" : 
                    s.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (activeTab === "admissions") {
      const apps = details.applications || [];
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h4 className="text-[14px] font-bold text-[#111] dark:text-white">Admission Tracking</h4>
          {apps.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No applications found.</p>
          ) : (
            <div className="space-y-3">
              {apps.map((a: any) => (
                <div key={a.id} className="p-4 bg-gray-50 dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
                  <p className="text-[13px] font-semibold text-[#111] dark:text-white">Program: {a.program_interest || "Undecided"}</p>
                  <p className="text-[12px] text-muted-foreground mt-1">Stage: <span className="font-medium capitalize">{a.stage}</span></p>
                  <p className="text-[12px] text-muted-foreground mt-1">Status: <span className="font-medium capitalize">{a.status}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "courses" || activeTab === "services") {
      const list = activeTab === "courses" ? details.courses : details.child_services;
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h4 className="text-[14px] font-bold text-[#111] dark:text-white capitalize">{activeTab}</h4>
          {(!list || list.length === 0) ? (
            <p className="text-[13px] text-muted-foreground">No {activeTab} found.</p>
          ) : (
            <div className="space-y-3">
              {list.map((item: any) => (
                <div key={item.id} className="p-3 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#111] dark:text-white capitalize">{item.title || item.service}</p>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-md uppercase",
                    item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                  )}>
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="px-5 py-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between shrink-0 bg-[#1099A1]">
          <h2 className="text-[16px] font-bold text-white">User Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white">
            <X size={18} />
          </button>
        </div>
        
        {renderTabs()}

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white dark:bg-[#111b21]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
