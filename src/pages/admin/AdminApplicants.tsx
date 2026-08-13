import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, FileText, Mail, Phone, BookOpen, Wallet, Check, X, ExternalLink, Inbox,
} from "lucide-react";
import { getApplicants, approveUser, rejectUser, type Applicant } from "@/services/adminService";
import { getResumeUrl } from "@/services/resumeService";
import { cn } from "@/utils/cn";

// ============================================================
// The review queue for tutors and counselors.
//
// Approve and reject already existed on the user list, but with no way to read
// the CV the applicant uploaded, which is the one thing a decision actually
// rests on. This page puts the CV, the subjects and the rate in front of the
// reviewer before they choose.
// ============================================================

type Tab = "pending" | "active" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Awaiting review" },
  { key: "active", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function Detail({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-[#667781] dark:text-[#8696a0]">
      <span className="text-primary shrink-0">{icon}</span>
      {children}
    </span>
  );
}

function RejectDialog({
  applicant,
  onCancel,
  onConfirm,
}: {
  applicant: Applicant;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#182229] rounded-2xl w-full max-w-md p-5 shadow-xl">
        <h3 className="text-[16px] font-bold text-[#111] dark:text-white">
          Reject {applicant.full_name}?
        </h3>
        <p className="text-[13px] text-[#667781] dark:text-[#8696a0] mt-1">
          They are told the outcome, and this reason is included. Keep it something
          you would be comfortable having them read.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Reason for rejection"
          className="w-full mt-3 px-3 py-2.5 bg-transparent border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[14px] text-[#111] dark:text-white outline-none focus:border-primary transition-colors resize-none"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] font-medium border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-secondary text-white hover:opacity-90 transition-opacity"
          >
            Reject application
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminApplicants() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Applicant | null>(null);

  const { data: applicants = [], isLoading } = useQuery({
    queryKey: ["applicants", tab],
    queryFn: () => getApplicants(tab),
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["applicants-pending-count"],
    queryFn: async () => (await getApplicants("pending")).length,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["applicants"] });
    await queryClient.invalidateQueries({ queryKey: ["applicants-pending-count"] });
  }

  async function decide(applicant: Applicant, approve: boolean, reason = "") {
    setBusy(applicant.id);
    try {
      const result = approve
        ? await approveUser(applicant.id)
        : await rejectUser(applicant.id, reason);
      if (!result.success) throw new Error(result.error);
      toast.success(`${applicant.full_name} ${approve ? "approved" : "rejected"}`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save that decision");
    } finally {
      setBusy(null);
      setRejecting(null);
    }
  }

  /** The bucket is private, so a link is minted on demand and expires. */
  async function openCv(applicant: Applicant) {
    setBusy(applicant.id);
    try {
      const url = await getResumeUrl(applicant.resume_url);
      if (!url) {
        toast.error("This applicant has not uploaded a CV.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="bg-primary text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden">
        <svg
          className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none"
          viewBox="0 0 400 200" preserveAspectRatio="none" fill="none" aria-hidden="true"
        >
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
        </svg>

        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Applicants</h1>
          <p className="flex items-center gap-1.5 text-white/80 text-[13px] mt-1">
            <Inbox size={13} />
            {pendingCount === 0
              ? "Nothing awaiting review"
              : `${pendingCount} awaiting review`}
          </p>

          <div className="flex items-center gap-6 mt-6 border-b border-white/20 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "pb-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors",
                  tab === t.key ? "border-white text-white" : "border-transparent text-white/70 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-4xl">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : applicants.length === 0 ? (
          <div className="text-center py-16">
            <Inbox size={40} className="mx-auto text-[#aebac1] mb-3" />
            <p className="text-[15px] font-semibold text-foreground">
              {tab === "pending" ? "No applications waiting" : `Nothing here`}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              {tab === "pending"
                ? "New tutor and counselor signups land here after they finish onboarding."
                : "Decisions you make will show up under this tab."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {applicants.map((a) => {
              const isBusy = busy === a.id;
              return (
                <li
                  key={a.id}
                  className="bg-card border border-border rounded-2xl p-4 md:p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={a.avatar_url ?? ""}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover bg-muted shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-semibold text-foreground">{a.full_name}</h2>
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {a.role}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          applied {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {a.bio && (
                        <p className="text-[13.5px] text-foreground/90 mt-2 leading-relaxed">{a.bio}</p>
                      )}

                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                        {a.email && <Detail icon={<Mail size={13} />}>{a.email}</Detail>}
                        {a.phone && <Detail icon={<Phone size={13} />}>{a.phone}</Detail>}
                        {!!a.subjects?.length && (
                          <Detail icon={<BookOpen size={13} />}>{a.subjects.join(", ")}</Detail>
                        )}
                        {a.hourly_rate != null && (
                          <Detail icon={<Wallet size={13} />}>
                            {a.hourly_rate} {a.rate_currency ?? "ETB"} per hour
                          </Detail>
                        )}
                      </div>

                      {a.status === "rejected" && a.rejection_reason && (
                        <p className="text-[13px] text-[#8a6a2a] dark:text-secondary mt-2.5">
                          Rejected: {a.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                    <button
                      onClick={() => openCv(a)}
                      disabled={isBusy || !a.resume_url}
                      title={a.resume_url ? "Open the CV" : "No CV uploaded"}
                      className={cn(
                        "mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium border transition-colors",
                        a.resume_url
                          ? "border-primary/30 text-primary hover:bg-primary/10"
                          : "border-border text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      <FileText size={14} />
                      {a.resume_url ? "View CV" : "No CV uploaded"}
                      {a.resume_url && <ExternalLink size={12} />}
                    </button>

                    {a.status === "pending" && (
                      <div className="mt-3 flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => setRejecting(a)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium border border-border hover:bg-muted/60 disabled:opacity-50 transition-colors"
                        >
                          <X size={14} /> Reject
                        </button>
                        <button
                          onClick={() => decide(a, true)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rejecting && (
        <RejectDialog
          applicant={rejecting}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => decide(rejecting, false, reason)}
        />
      )}
    </div>
  );
}
