import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink, RotateCcw, Check, Clock, X, LogIn, Trash2, Lock, Unlock } from "lucide-react";
import { supabase, BACKEND } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { postAuthPath } from "@/utils/roleRoutes";
import { getChildServices, type ServiceName } from "@/services/parentService";
import { cn } from "@/utils/cn";

// ============================================================
// Developer console. Its own route, deliberately.
//
// Nothing in here belongs inside the product: a client looking at the app
// should see exactly what a real user sees, with no toggles or reset buttons
// anywhere near real content. This page is the one place all of that lives.
//
// Gated on DEV_PREVIEW and refused outright in a production build, so it cannot
// ship by accident. See docs/PRODUCTION_UNMOCK_CHECKLIST.md.
// ============================================================

const DEMO_PASSWORD = "demo123";

/**
 * Screens that were built to compare against the one that shipped.
 *
 * They stay reachable because showing somebody the alternative is easier than
 * describing it, and they stay out of the sidebar because a parent seeing
 * three billing pages is a bug.
 */
const PROTOTYPES: { name: string; href: string; note: string }[] = [
  {
    name: "Billing 1",
    href: "/parent/billing-1",
    note: "Tabs across the body. The shape the real billing page took.",
  },
  {
    name: "Billing 2",
    href: "/parent/billing-2",
    note: "One surface, no tabs, card in the header.",
  },
  {
    name: "Billing 4",
    href: "/parent/billing-4",
    note: "Tabs, with each plan opening into the week it was booked into.",
  },
  {
    name: "Courses v1",
    href: "/parent/courses-v1",
    note: "Monthly lessons: pick a weekly routine, repeated for four weeks.",
  },
  {
    name: "Courses v2",
    href: "/parent/courses-v2",
    note: "Monthly lessons: pick individual dates across the month.",
  },
];

interface DevProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  is_onboarded: boolean;
  avatar_url: string | null;
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-[#97CE9D]/25 text-[#2d7a54] dark:text-[#97CE9D]"
      : status === "pending"
        ? "bg-[#CAA25F]/20 text-[#8a6a2a] dark:text-[#CAA25F]"
        : "bg-[#8696a0]/20 text-[#54656f] dark:text-[#aebac1]";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", tone)}>
      {status}
    </span>
  );
}

export function DevConsole() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile: me } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DevProfile | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["dev-profiles"],
    queryFn: async (): Promise<DevProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, status, is_onboarded, avatar_url")
        .order("role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentIds = profiles.filter((p) => p.role === "student").map((p) => p.id);

  const { data: services = [] } = useQuery({
    queryKey: ["dev-services", studentIds.join(",")],
    queryFn: () => getChildServices(studentIds),
    enabled: studentIds.length > 0,
  });

  // Read-only now: a service is active when it has been paid for (an enrolment,
  // an admissions plan), which is what getChildServices reports. There is no
  // toggle, because access no longer follows a switch.
  const isActive = (studentId: string, service: ServiceName) =>
    services.some((s) => s.student_id === studentId && s.service === service && s.is_active);

  async function deleteAccount(target: DevProfile) {
    setBusy(target.id);
    try {
      const res = await fetch("/api/dev-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId: target.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Delete failed");
      await queryClient.invalidateQueries({ queryKey: ["dev-profiles"] });
      toast.success(`Deleted ${target.email}`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not delete that account");
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  }

  const isAdmin = me?.role === "admin";

  async function signInAs(email: string) {
    setBusy(email);
    try {
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: DEMO_PASSWORD,
      });
      if (error) throw error;

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, status, is_onboarded")
        .eq("id", data.user!.id)
        .maybeSingle();

      toast.success(`Signed in as ${email}`);
      navigate(postAuthPath(prof ?? { role: "student", status: "active", is_onboarded: true }));
    } catch (err: any) {
      toast.error(err.message ?? "Could not sign in");
    } finally {
      setBusy(null);
    }
  }

  /** Needs admin rights for anyone but yourself; RLS enforces that, not this UI. */
  async function patch(target: DevProfile, updates: Record<string, unknown>, label: string) {
    setBusy(target.id);
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", target.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["dev-profiles"] });
      toast.success(`${target.full_name}: ${label}`);
    } catch (err: any) {
      toast.error(
        isAdmin ? err.message : "Sign in as admin first, row level security blocks this otherwise."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] text-[#111] dark:text-[#e9edef]">
      <header className="bg-[#111b21] text-white px-6 py-5 md:px-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Developer console</h1>
          <p className="text-white/70 text-[13px] mt-1">
            Not part of the product. Nothing here is visible to a user.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-[12px] font-semibold",
                BACKEND === "local" ? "bg-[#1099A1] text-white" : "bg-[#CAA25F] text-[#111]"
              )}
            >
              backend: {BACKEND}
            </span>
            {BACKEND === "remote" && (
              <span className="text-[12px] text-[#CAA25F]">
                Careful, these actions change the hosted project.
              </span>
            )}
            <a
              href="http://localhost:54323"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-white/80 hover:text-white flex items-center gap-1"
            >
              Studio <ExternalLink size={12} />
            </a>
            <a
              href="http://localhost:54324"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-white/80 hover:text-white flex items-center gap-1"
            >
              Mailpit <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-10 py-6 flex flex-col gap-6">
        {!isAdmin && (
          <p className="text-[13px] text-[#667781] dark:text-[#8696a0] bg-white dark:bg-[#182229] border border-[#e9edef] dark:border-[#2a3942] rounded-xl px-4 py-3">
            Changing another account needs admin rights, because row level security
            allows it for admins only. Sign in as <strong>admin@yakal.com</strong> below first.
          </p>
        )}

        <section className="bg-white dark:bg-[#182229] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e9edef] dark:border-[#2a3942]">
            <h2 className="text-[15px] font-semibold">Accounts</h2>
            <p className="text-[12px] text-[#667781] dark:text-[#8696a0] mt-0.5">
              Every account uses the password {DEMO_PASSWORD}.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-[#1099A1]" size={22} />
            </div>
          ) : (
            <ul className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {profiles.map((p) => {
                const isBusy = busy === p.id || busy === p.email;
                const needsApproval = p.role === "tutor" || p.role === "counselor";
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <img
                      src={p.avatar_url ?? ""}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover bg-[#e9edef] dark:bg-[#2a3942] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium truncate">{p.full_name}</span>
                        <StatusPill status={p.status} />
                        {!p.is_onboarded && (
                          <span className="text-[11px] text-[#CAA25F] font-medium">
                            onboarding pending
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#667781] dark:text-[#8696a0] truncate">
                        {p.email} - {p.role}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => p.email && signInAs(p.email)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1099A1] text-white text-[12px] font-medium hover:bg-[#0d7f86] disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                        Sign in
                      </button>

                      {/* Read-only. Access follows payment now, so this reports
                          what the student has (an enrolment, an admissions
                          plan) rather than offering a switch that no longer
                          controls anything. */}
                      {p.role === "student" &&
                        (["tutoring", "admissions"] as ServiceName[]).map((service) => {
                          const on = isActive(p.id, service);
                          return (
                            <span
                              key={service}
                              title={`${service} is ${on ? "active (paid)" : "not active"} for ${p.full_name}`}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border",
                                on
                                  ? "border-[#1099A1] bg-[#1099A1]/10 text-[#1099A1]"
                                  : "border-[#e9edef] dark:border-[#2a3942] text-[#667781] dark:text-[#8696a0]"
                              )}
                            >
                              {on ? <Unlock size={12} /> : <Lock size={12} />}
                              {service}
                            </span>
                          );
                        })}

                      <button
                        onClick={() =>
                          patch(
                            p,
                            {
                              is_onboarded: false,
                              ...(needsApproval
                                ? { status: "pending", resume_url: null, subjects: null }
                                : {}),
                            },
                            "will replay onboarding"
                          )
                        }
                        disabled={isBusy}
                        title="Replay onboarding on next load"
                        className="p-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw size={14} />
                      </button>

                      {needsApproval && (
                        <>
                          <button
                            onClick={() => patch(p, { status: "pending" }, "back to pending")}
                            disabled={isBusy}
                            title="Put back in the approval queue"
                            className="p-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] disabled:opacity-50 transition-colors"
                          >
                            <Clock size={14} />
                          </button>
                          <button
                            onClick={() =>
                              patch(p, { status: "active", rejection_reason: null }, "approved")
                            }
                            disabled={isBusy}
                            title="Approve"
                            className="p-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] disabled:opacity-50 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() =>
                              patch(
                                p,
                                { status: "rejected", rejection_reason: "Rejected from the dev console" },
                                "rejected"
                              )
                            }
                            disabled={isBusy}
                            title="Reject"
                            className="p-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] disabled:opacity-50 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setConfirmDelete(p)}
                        disabled={isBusy}
                        title="Delete this account"
                        className="p-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[#CAA25F] hover:bg-[#CAA25F]/10 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-[#182229] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e9edef] dark:border-[#2a3942]">
            <h2 className="text-[15px] font-semibold">Alternative screens</h2>
            <p className="text-[12px] text-[#667781] dark:text-[#8696a0] mt-0.5">
              Kept for showing a client the options. They are not in the parent's
              sidebar, so nobody reaches them by accident. Sign in as a parent
              first or they will bounce you to the login page.
            </p>
          </div>
          <ul className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
            {PROTOTYPES.map((p) => (
              <li key={p.href} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{p.name}</p>
                  <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">{p.note}</p>
                </div>
                <button
                  onClick={() => navigate(p.href)}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[12px] font-medium hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition-colors"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white dark:bg-[#182229] border border-[#e9edef] dark:border-[#2a3942] rounded-xl px-4 py-4">
          <h2 className="text-[15px] font-semibold mb-2">From the terminal</h2>
          <p className="text-[12.5px] text-[#667781] dark:text-[#8696a0] mb-3">
            The same states, scriptable, for resetting between two runs of a demo.
          </p>
          <pre className="text-[12px] bg-[#f0f2f5] dark:bg-[#111b21] rounded-lg p-3 overflow-x-auto leading-relaxed">
{`npm run demo status                    where everyone stands
npm run demo reset-onboarding tutor    replay the wizard
npm run demo pending tutor             back into the queue
npm run demo approve tutor             approve
npm run demo scratch                   free up the signup address
npm run demo clean                     drop leftover test accounts`}
          </pre>
        </section>
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#182229] rounded-2xl w-full max-w-md p-5 shadow-xl">
            <h3 className="text-[16px] font-bold">Delete {confirmDelete.full_name}?</h3>
            <p className="text-[13px] text-[#667781] dark:text-[#8696a0] mt-2 leading-relaxed">
              This removes <strong>{confirmDelete.email}</strong> and everything attached to
              it: profile, conversations, messages, sessions. It cannot be undone.
            </p>
            <p className="text-[12.5px] text-[#667781] dark:text-[#8696a0] mt-2">
              A seeded account comes back with <code>npm run db:seed</code>.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-[13px] font-medium border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAccount(confirmDelete)}
                disabled={busy === confirmDelete.id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#CAA25F] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy === confirmDelete.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
