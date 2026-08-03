import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Mail, Calendar, LogOut, Camera, Bell, X, SquarePenIcon, Phone, Users, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ParentProfile() {
  const { user, profile, signOut } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success("Profile picture updated successfully!");
    }
  };

  const stats = [
    { label: "Children Enrolled", value: "2", icon: <Users size={18} />, trend: "", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/10", cardBg: "bg-blue-50/50 dark:bg-blue-900/5 border-blue-100 dark:border-blue-900/30" },
    { label: "Active Courses", value: "3", icon: <Calendar size={18} />, trend: "", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/10", cardBg: "bg-green-50/50 dark:bg-green-900/5 border-green-100 dark:border-green-900/30" },
    { label: "Next Payment Due", value: "Nov 15", icon: <CreditCard size={18} />, trend: "", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10", cardBg: "bg-amber-50/50 dark:bg-amber-900/5 border-amber-100 dark:border-amber-900/30" }
  ];

  const recentActivity = [
    { date: "Oct 29", title: "Payment processed for Fall Semester", status: "Paid", type: "Billing", time: "$1,200.00" },
    { date: "Oct 15", title: "Brooklyn enrolled in AP Physics", status: "Active", type: "Enrollment", time: "Course Started" },
    { date: "Oct 11", title: "Austin completed Algebra II Assessment", status: "Done", type: "Academics", time: "Grade: 92%" },
    { date: "Oct 05", title: "New message from Dr. Alex", status: "Read", type: "Communication", time: "Regarding Brooklyn" },
    { date: "Sep 28", title: "Fall Semester Registration", status: "Confirmed", type: "Enrollment", time: "Completed" },
  ];

  return (
    <PageWrapper>
      <div className="flex flex-col min-h-0 bg-background overflow-y-auto">
        {/* Teal Header */}
        <div className="bg-[#1099A1] text-white pt-8 md:pt-12 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 px-6 md:px-10 lg:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative group cursor-pointer shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/20 bg-black/20">
                  <img
                    src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}
                    alt={profile?.full_name || "User"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" size={24} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              <div className="flex flex-col min-w-0">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight truncate">
                  {profile?.full_name || "Parent"}
                </h1>
                <p className="text-white/80 text-[14px] mt-3 max-w-xl">
                  {profile?.bio || "Parent of Brooklyn and Austin. Passionate about ensuring my children receive the best academic support and guidance."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold h-11 px-4 rounded-lg transition-colors backdrop-blur-sm w-full md:w-auto"
              >
                <SquarePenIcon size={16} /> Edit Profile
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center gap-2 !bg-[#97CE9D]/40 border border-[#97CE9D]/40 hover:!bg-[#CAA25F]/30 !text-white font-semibold h-11 px-4 rounded-lg transition-colors w-full md:w-auto"
              >
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>

          {/* Stats Grid inside header */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 mt-10">
            {stats.map((stat, i) => (
              <div key={i} className="p-6 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 text-white/80 mb-2 uppercase text-[12px] font-bold tracking-wider">
                  {stat.icon} {stat.label}
                </div>
                <div className="text-3xl font-black tracking-tight">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lower Content */}
        <div className="p-6 md:p-10 lg:p-12 mx-auto w-full max-w-[1400px] flex flex-col lg:flex-row gap-10">

          {/* Left Column: Contact & Details */}
          <div className="w-full lg:w-[320px] shrink-0 space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Contact & Details</h3>

            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <Mail size={20} className="text-[#54656f] dark:text-[#aebac1]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5 uppercase tracking-wide">Email</p>
                  <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <Phone size={20} className="text-[#54656f] dark:text-[#aebac1]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5 uppercase tracking-wide">Phone Number</p>
                  <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">+1 (555) 123-4567</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <Bell size={20} className="text-[#54656f] dark:text-[#aebac1]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5 uppercase tracking-wide">Notifications</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">
                      Marketing Alerts
                    </p>
                    <button
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        notificationsEnabled ? "bg-[#1099A1]" : "bg-gray-300 dark:bg-gray-700"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        notificationsEnabled ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Recent Activity */}
          <div className="flex-1 w-full space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Recent Activity</h3>

            <div className="flex flex-col">
              <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center py-6 gap-6 hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors -mx-4 px-4 rounded-xl">
                    <div className="flex flex-col items-center justify-center shrink-0 w-12 text-[#1099A1]">
                      <span className="text-[20px] font-bold leading-none mb-0.5">{activity.date.split(" ")[1]}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{activity.date.split(" ")[0]}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-bold text-[#111] dark:text-white truncate mb-1">{activity.title}</h4>
                      <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">{activity.time}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mt-4 sm:mt-0">
                      <span className={cn(
                        "text-[14px] font-bold",
                        activity.status === "Done" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                      )}>
                        {activity.status}
                      </span>
                      <span className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1] w-16 text-right">
                        {activity.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
              <h2 className="text-[20px] font-bold text-[#111] dark:text-white">Edit Profile</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Avatar Upload in Modal */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                    <img
                      src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="text-white" size={20} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">Click to update picture</p>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Full Name</label>
                <input
                  type="text"
                  defaultValue={profile?.full_name || ""}
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Email Address</label>
                <input
                  type="email"
                  defaultValue={user?.email || ""}
                  disabled
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] text-[#54656f] dark:text-[#aebac1] cursor-not-allowed opacity-70"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
              <Button
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Profile saved!");
                  setEditOpen(false);
                }}
                className="h-10 px-6 bg-[#1099A1] hover:bg-[#1099A1]/90 text-white font-bold"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
