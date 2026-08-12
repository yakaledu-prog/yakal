import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Mail, LogOut, Camera, X, SquarePenIcon, Phone } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBilling } from "@/services/packageService";
import { money } from "@/services/billingService";
import { toast } from "sonner";
import { dicebearUrl } from "@/utils/avatar";

/**
 * One labelled fact in the teal banner. Module level: a component declared
 * inside the page body is a new type every render, so React rebuilds it.
 */
function HeaderFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-white/70">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
        <p className="truncate text-[14px] text-white">{value || "Not set"}</p>
      </div>
    </div>
  );
}

export function ParentProfile() {
  const { user, profile, signOut } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success("Profile picture updated successfully!");
    }
  };

  const { data: billing } = useQuery({
    queryKey: ["billing", user?.id],
    queryFn: () => getBilling(user!.id),
    enabled: !!user?.id,
  });

  /**
   * What has actually been paid, newest first.
   *
   * Only paid invoices: an unpaid one is a thing to do, and this is a record
   * of what happened. The service is derived rather than stored, since an
   * invoice against a course is tutoring and one without is counselling.
   */
  const payments = (billing?.invoices ?? [])
    .filter((i) => i.paidAt)
    .sort((a, b) => (a.paidAt! < b.paidAt! ? 1 : -1));

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
            {/* Centred on a phone: stacked and left aligned, the avatar sat
                in a wide empty band and read as misplaced. */}
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:text-left">
              <div className="relative group cursor-pointer shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/20 bg-black/20">
                  <img
                    src={profile?.avatar_url || dicebearUrl(profile?.full_name || "parent")}
                    alt={profile?.full_name || "User"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" size={24} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              <div className="flex min-w-0 flex-col items-center md:items-start">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight truncate">
                  {profile?.full_name || "Parent"}
                </h1>
                {/* Only when written. The fallback named two children who do
                    not exist, so every parent without a bio read as the parent
                    of Brooklyn and Austin. */}
                {profile?.bio && (
                  <p className="mt-3 max-w-xl text-[14px] text-white/80">{profile.bio}</p>
                )}
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

          {/* Contact, where the stat cards were. Those counted children and
              courses, which the pages for children and courses already say,
              and one of them was a date nothing calculated. */}
          <div className="relative z-10 mt-10 flex flex-wrap justify-center gap-x-14 gap-y-5 px-6 pb-8 md:justify-start md:px-10 lg:px-12">
            <HeaderFact icon={<Mail size={15} />} label="Email" value={user?.email} />
            <HeaderFact icon={<Phone size={15} />} label="Phone" value={profile?.phone} />
          </div>
        </div>

        {/* Lower Content */}
        <div className="mx-auto w-full max-w-[1400px] p-6 md:p-10 lg:p-12">
          <h3 className="mb-4 text-[18px] font-bold text-[#111] dark:text-white">Payment history</h3>

          {payments.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-muted-foreground">
              Nothing paid yet. Courses and counselling plans appear here once they are bought.
            </p>
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {payments.map((p) => {
                const paid = new Date(p.paidAt!);
                return (
                  <div key={p.id} className="flex items-center gap-6 py-5">
                    <div className="flex w-12 shrink-0 flex-col items-center justify-center text-[#1099A1]">
                      <span className="mb-0.5 text-[20px] font-bold leading-none">{paid.getDate()}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {paid.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-[15px] font-semibold text-[#111] dark:text-white">
                        {p.description}
                      </h4>
                      <p className="truncate text-[13px] text-[#54656f] dark:text-[#aebac1]">
                        {p.courseId ? "Tutoring" : "College counselling"}
                        {p.studentName ? ` \u00b7 ${p.studentName}` : ""}
                      </p>
                    </div>

                    <span className="shrink-0 text-[15px] font-semibold text-[#111] dark:text-white">
                      {money(p.amountCents)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
                      src={profile?.avatar_url || dicebearUrl(profile?.full_name || "parent")}
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
