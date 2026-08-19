import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminUser, getAdminUserDetails } from "@/services/adminService";
import { X, Loader2, Calendar, Users, DollarSign, BookOpen, GraduationCap, Mail, User, Inbox } from "lucide-react";
import { ViewCvButton } from "@/components/shared/ViewCvButton";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { format } from "date-fns";
import { dicebearUrl } from "@/utils/avatar";

function safeFormatDate(dateStr: string | null | undefined, fmt: string) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Invalid Date";
  return format(d, fmt);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox strokeWidth={1} className="w-12 h-12 text-muted-foreground/30 mb-3" />
      <p className="text-[13px] font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

interface AdminUserViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

export function AdminUserViewModalTabbed({ isOpen, onClose, user }: AdminUserViewModalProps) {
  const [activeTab, setActiveTab] = useState("");

  const { data: details, isLoading, isError, error } = useQuery({
    queryKey: ["admin-user-details", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await getAdminUserDetails(user.id, user.role);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: isOpen && !!user,
    retry: 1, // Add this so it doesn't infinite loop for a long time
  });

  useEffect(() => {
    if (isOpen && user) {
      if (user.role === "parent") setActiveTab("children");
      else if (user.role === "student") setActiveTab("sessions");
      else setActiveTab("students");
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const renderTabs = () => {
    const tabs = [];

    if (user.role === "parent") {
      tabs.push({ id: "children", label: "Children", icon: Users });
      tabs.push({ id: "invoices", label: "Payment History", icon: DollarSign });
    } else if (user.role === "student") {
      tabs.push({ id: "sessions", label: "Sessions", icon: Calendar });
      tabs.push({ id: "admissions", label: "Admissions", icon: GraduationCap });
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
      <div className="flex overflow-x-auto gap-4 px-6 pt-4 border-b border-white/20 custom-scrollbar shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-2 pb-3 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2",
              activeTab === t.id
                ? "text-white border-white"
                : "text-white/70 border-transparent hover:text-white"
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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-[13px] text-muted-foreground">Loading details...</p>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <p className="text-[14px] font-bold text-red-500">Error loading details</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      );
    }

    if (!details) return null;

    if (activeTab === "invoices") {
      const invoices = details.invoices || [];
      return (
        <div className="animate-in fade-in duration-300">
          {invoices.length === 0 ? (
            <EmptyState message="No records found." />
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="p-4 flex items-center justify-between bg-white dark:bg-[#111b21]">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111] dark:text-white">{inv.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{safeFormatDate(inv.created_at, "MMM d, yyyy")}</p>
                  </div>
                  <div className="text-right">
                    {/* A parent's row is an invoice and a tutor's is an
                        earning, but the service hands both over in the same
                        shape, so there is nothing to branch on here. */}
                    <p className="text-[14px] font-bold text-[#111] dark:text-white">{money(inv.amount_cents)}</p>
                    <p className={cn("text-[11px] font-semibold uppercase mt-1",
                      inv.status === "paid" || inv.status === "settled" ? "text-emerald-500" : "text-amber-500"
                    )}>
                      {inv.status}
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
        <div className="animate-in fade-in duration-300">
          {(!list || list.length === 0) ? (
            <EmptyState message="None found." />
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
              {list.map((s: any) => (
                <div key={s.id} className="flex items-center gap-4 p-4 bg-white dark:bg-[#111b21]">
                  <img src={s.avatar_url || dicebearUrl(s.full_name)} alt={s.full_name} className="w-10 h-10 rounded-full border border-black/5" />
                  <div>
                    <p className="text-[13px] font-bold text-[#111] dark:text-white">{s.full_name}</p>
                    {s.grade_level && <p className="text-[11px] text-muted-foreground mt-0.5">{s.grade_level}</p>}
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
        <div className="animate-in fade-in duration-300">
          {sessions.length === 0 ? (
            <EmptyState message="No sessions found." />
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
              {sessions.map((s: any) => (
                <div key={s.id} className="p-4 flex items-center justify-between bg-white dark:bg-[#111b21]">
                  <div className="flex items-center gap-3">
                    {s.other_profile && (
                      <img
                        src={s.other_profile.avatar_url || dicebearUrl(s.other_profile.full_name)}
                        alt={s.other_profile.full_name}
                        className="w-10 h-10 rounded-full border border-black/5"
                      />
                    )}
                    <div>
                      <p className="text-[13px] font-semibold text-[#111] dark:text-white">
                        {s.other_profile ? s.other_profile.full_name : (s.title || "Untitled Session")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {s.start_time ? safeFormatDate(s.start_time, "MMM d, h:mm a") : "No date set"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-[11px] font-semibold uppercase",
                      s.status === "completed" ? "text-primary" :
                        s.status === "cancelled" ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {s.status}
                    </p>
                  </div>
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
        <div className="animate-in fade-in duration-300">
          {apps.length === 0 ? (
            <EmptyState message="No applications found." />
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
              {apps.map((a: any) => (
                <div key={a.id} className="p-4 bg-white dark:bg-[#111b21] flex justify-between items-center">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111] dark:text-white">Program: {a.program_interest || "Undecided"}</p>
                    <p className="text-[12px] text-muted-foreground mt-1">Stage: <span className="font-medium capitalize">{a.stage}</span></p>
                    {/* Who to go to about this student. A face rather than a
                        name: the row stores an id, and an admin recognises the
                        handful of counselors on sight faster than they read
                        them. The name stays on the image for anyone hovering,
                        and for a screen reader. */}
                    <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      Counselor:
                      {a.counselor_name ? (
                        <img
                          src={a.counselor_avatar_url || dicebearUrl(a.counselor_name)}
                          alt={a.counselor_name}
                          title={a.counselor_name}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <span className="font-medium text-[#111] dark:text-white">Not assigned</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">{a.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "courses") {
      const list = details.courses;
      return (
        <div className="animate-in fade-in duration-300">
          {(!list || list.length === 0) ? (
            <EmptyState message="None found." />
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
              {(list || []).map((item: any) => (
                <div key={item.id} className="p-4 bg-white dark:bg-[#111b21] flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#111] dark:text-white capitalize">{item.title}</p>
                  <span className={cn(
                    "text-[11px] font-semibold uppercase",
                    item.is_active ? "text-primary" : "text-muted-foreground"
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-white z-[60]"
        >
          <X size={20} />
        </button>

        <div className="relative pt-6 bg-primary shrink-0 rounded-t-2xl">
          <svg className="absolute right-0 bottom-0 h-full w-[60%] md:w-[40%] text-white/10 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 flex items-center gap-4 px-6 mb-4">
            <img
              src={user.avatar_url || dicebearUrl(user.full_name)}
              alt={user.full_name}
              className={cn(
                "w-16 h-16 rounded-full border-2 border-primary shadow-inner bg-white object-cover shrink-0 self-start mt-1",
                user.status !== "active" && "grayscale opacity-70"
              )}
            />
            <div className={cn("flex-1", user.status !== "active" && "opacity-80")}>
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <h2 className="text-[20px] font-bold text-white leading-tight">{user.full_name}</h2>
                {user.role === "student" && !isLoading && details?.child_services && (() => {
                  const activeServices = details.child_services.filter((s: any) => s.is_active);
                  if (activeServices.length === 0) return null;
                  return (
                    <div className="flex items-center gap-2 text-[13px] font-medium text-white/80">
                      <span className="text-white/40">|</span>
                      <span className="capitalize tracking-wide">
                        [ {activeServices.map((s: any) => s.service).join(", ")} ]
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Info Line */}
              <div className="flex flex-wrap items-center gap-5 text-[12px] font-medium text-white/90">
                <div className="flex items-center gap-1.5 capitalize">
                  <User size={14} />
                  {user.role}
                </div>
                {user.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={14} />
                    {user.email}
                  </div>
                )}
                {user.created_at ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {safeFormatDate(user.created_at, "MMM d, yyyy")}
                  </div>
                ) : null}
              </div>

              {/* Bio & CV for Tutors/Counselors */}
              {(user.role === "tutor" || user.role === "counselor") && (
                <div className="mt-3 max-w-xl">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-white/60 text-[12px]"><Loader2 size={12} className="animate-spin" /> Loading bio...</div>
                  ) : details?.profile?.bio ? (
                    <p className="text-[13px] text-white/80 leading-relaxed line-clamp-3">
                      {details.profile.bio}
                    </p>
                  ) : null}

                  {!isLoading && details?.profile?.cv_url && (
                    <ViewCvButton
                      path={details.profile.cv_url}
                      label="View Resume"
                      className="mt-2 !rounded-md !border-white/20 bg-white/10 !px-2.5 !py-1 !text-[11px] font-semibold text-white hover:!bg-white/20"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10">
            {renderTabs()}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50 dark:bg-[#111b21]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
