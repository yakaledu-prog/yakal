import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Mail, Phone, LogOut, GraduationCap } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";

export function CounselorProfile() {
  const { profile, signOut } = useAuth();

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <div className="bg-[#1099A1] text-white p-6 md:p-10">
          <div className="max-w-[700px] mx-auto flex items-center gap-4">
            <img src={profile?.avatar_url || dicebearUrl(profile?.full_name || "C")} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-white/20" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{profile?.full_name}</h1>
              <p className="text-white/80 text-[14px] flex items-center gap-1.5"><GraduationCap size={15} /> College Counselor</p>
            </div>
          </div>
        </div>

        <div className="max-w-[700px] mx-auto p-6 md:p-10 space-y-4">
          {profile?.bio && (
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5">
              <p className="text-[13px] font-semibold text-[#667781] dark:text-[#8696a0] uppercase tracking-wider mb-2">About</p>
              <p className="text-[14px] text-[#111] dark:text-[#e9edef] leading-relaxed">{profile.bio}</p>
            </div>
          )}
          <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
            <Row icon={<Mail size={18} />} label="Email" value={profile?.email || "-"} />
            <Row icon={<Phone size={18} />} label="Phone" value={profile?.phone || "-"} />
          </div>
          <button onClick={() => signOut()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[#c0392b] text-[14px] font-semibold hover:bg-[#c0392b]/5 transition-colors">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-[#1099A1]">{icon}</span>
      <div>
        <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">{label}</p>
        <p className="text-[14px] text-[#111] dark:text-white font-medium">{value}</p>
      </div>
    </div>
  );
}
