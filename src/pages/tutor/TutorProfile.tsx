import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Edit2, Mail, Settings, Calendar, CheckCircle, Clock, LogOut, Camera, Moon, Sun, Bell, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export function TutorProfile() {
  const { user, profile, signOut } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success("Profile picture updated successfully!");
    }
  };

  const toggleTheme = async () => {
    const isDark = document.documentElement.classList.toggle("dark");
    const newTheme = isDark ? "dark" : "light";
    
    if (user?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', user.id);
        
      if (error) {
        toast.error("Failed to save theme preference");
        console.error("Theme save error:", error);
      }
    }
  };

  const stats = [
    { label: "Active Courses", value: "3", icon: <Calendar size={18} />, trend: "+1 this month", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/10", cardBg: "bg-blue-50/50 dark:bg-blue-900/5 border-blue-100 dark:border-blue-900/30" },
    { label: "Completed Sessions", value: "12", icon: <CheckCircle size={18} />, trend: "Top 20%", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/10", cardBg: "bg-green-50/50 dark:bg-green-900/5 border-green-100 dark:border-green-900/30" },
    { label: "Upcoming Tasks", value: "5", icon: <Clock size={18} />, trend: "Due this week", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10", cardBg: "bg-amber-50/50 dark:bg-amber-900/5 border-amber-100 dark:border-amber-900/30" }
  ];

  const recentActivity = [
    { date: "Oct 29", title: "1-on-1 Mentorship: Algebra", status: "Done", type: "Session", time: "11:00 - 12:30" },
    { date: "Oct 15", title: "Variables Practice Worksheet", status: "Done", type: "Task", time: "Completed" },
    { date: "Oct 11", title: "Pre-Calculus Assessment", status: "Pending", type: "Task", time: "Due in 2 days" },
    { date: "Oct 05", title: "Group Review: Physics", status: "Done", type: "Session", time: "14:00 - 15:30" },
    { date: "Sep 28", title: "Geometry Fundamentals Quiz", status: "Done", type: "Task", time: "Completed" },
  ];

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-8">

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Left Column: Profile Card */}
          <div className="w-full lg:w-[350px] space-y-6 shrink-0">
            {/* Main Info */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-8 flex flex-col items-center text-center shadow-sm relative">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="absolute top-4 right-4 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors"
              >
                <Edit2 size={18} />
              </button>

              <div className="relative mb-4 group cursor-pointer">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-[#111b21] shadow-lg">
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

              <h2 className="text-[24px] font-bold text-[#111] dark:text-white mb-1">
                {profile?.full_name || "Tutor"}
              </h2>

              <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[12px] font-bold px-3 py-1 rounded-full mb-6 inline-block capitalize">
                {profile?.role || "Tutor"}
              </span>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center justify-center w-full bg-[#1099A1] hover:bg-[#1099A1]/90 text-white font-bold h-12 rounded-xl transition-colors"
              >
                Edit Profile
              </button>
            </div>

            {/* Details List */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#f8f9fa] dark:bg-[#182329] rounded-lg shrink-0">
                  <Mail size={18} className="text-[#54656f] dark:text-[#aebac1]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5">Email</p>
                  <p className="text-[14px] font-semibold text-[#111] dark:text-white">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#f8f9fa] dark:bg-[#182329] rounded-lg shrink-0">
                  <Settings size={18} className="text-[#54656f] dark:text-[#aebac1]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5">Theme Preference</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white capitalize">
                      {document.documentElement.classList.contains('dark') ? 'Dark' : 'Light'} Mode
                    </p>
                    <button
                      onClick={toggleTheme}
                      className="p-1.5 rounded-md hover:bg-[#e9edef] dark:hover:bg-[#111b21] transition-colors text-[#54656f] dark:text-[#aebac1]"
                    >
                      <Moon size={16} className="hidden dark:block" />
                      <Sun size={16} className="block dark:hidden" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#f8f9fa] dark:bg-[#182329] rounded-lg shrink-0">
                  <Bell size={18} className="text-[#54656f] dark:text-[#aebac1]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium mb-0.5">Notifications</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white">
                      Marketing Alerts
                    </p>
                    <button
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        notificationsEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-700"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                        notificationsEnabled ? "translate-x-4.5" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#e9edef] dark:border-[#2a3942]">
                <button
                  onClick={() => signOut()}
                  className="flex items-center justify-center gap-3 w-full p-2 py-3 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors font-semibold"
                >
                  <LogOut size={16} />
                  <span>
                    Log Out
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Stats & Activity */}
          <div className="flex-1 w-full space-y-8">

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat, i) => (
                <div key={i} className={cn("border rounded-2xl p-6 shadow-sm flex flex-col", stat.cardBg)}>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[14px] font-medium text-[#54656f] dark:text-[#aebac1]">{stat.label}</p>
                    <div className={cn("p-2 rounded-lg", stat.bg, stat.color)}>
                      {stat.icon}
                    </div>
                  </div>
                  <h3 className={cn("text-[32px] font-bold mb-1", stat.color)}>{stat.value}</h3>
                  <div className="flex items-center gap-2 mt-auto">
                    <span className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1] bg-[#f8f9fa] dark:bg-[#182329] px-2 py-1 rounded">
                      {stat.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabbed Area */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-8 px-8 border-b border-[#e9edef] dark:border-[#2a3942]">
                <button className="py-4 border-b-2 border-primary text-[15px] font-bold text-primary">
                  Recent Activity
                </button>
                <button className="py-4 border-b-2 border-transparent text-[15px] font-semibold text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white transition-colors">
                  Certificates
                </button>
              </div>

              <div className="p-2">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] rounded-xl transition-colors border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
                    <div className="flex items-center gap-6">
                      <div className="text-center w-12 shrink-0">
                        <p className="text-[20px] font-bold text-[#111] dark:text-white leading-none">{item.date.split(' ')[1]}</p>
                        <p className="text-[12px] font-medium text-[#54656f] dark:text-[#aebac1] mt-1">{item.date.split(' ')[0]}</p>
                      </div>

                      <div>
                        <p className="text-[15px] font-bold text-[#111] dark:text-white">{item.title}</p>
                        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] mt-0.5">{item.time}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right shrink-0">
                      <span className={cn(
                        "px-3 py-1 text-[12px] font-bold rounded-full",
                        item.status === 'Done' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-[#CAA25F22] text-[#CAA25F]"
                      )}>
                        {item.status}
                      </span>
                      <span className="w-20 text-[14px] font-semibold text-[#111] dark:text-white hidden sm:block">
                        {item.type}
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
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
              <h2 className="text-[20px] font-bold text-[#111] dark:text-white">Edit Profile</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
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
                onClick={() => setIsEditModalOpen(false)}
                className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Profile saved!");
                  setIsEditModalOpen(false);
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
