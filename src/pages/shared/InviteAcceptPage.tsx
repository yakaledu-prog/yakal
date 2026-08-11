import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getInviteByToken, acceptInviteByToken, type InviteDetails } from "@/services/parentService";
import logoImg from "@/assets/images/logo.webp";

// ============================================================
// Where a child invitation link lands.
//
// One link, two outcomes. Signed out, it offers signup or login and carries
// itself along as ?next= so the child comes back here to finish. Signed in as
// the invited student, one click accepts and the account is linked to the
// parent - the relationship only. Services are bought per child separately and
// appear once paid for, so accepting grants no paid access by itself.
//
// The page never grants anything itself: accept_child_invite in the database
// checks the token, the account and the address. This only calls it and shows
// what happened.
// ============================================================

export function InviteAcceptPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { data: invite, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteByToken(token),
    enabled: !!token,
  });

  const loginHref = (mode: "login" | "signup") => {
    const p = new URLSearchParams({ next: `/invite/${token}` });
    if (mode === "signup") p.set("mode", "signup");
    if (invite?.email) p.set("email", invite.email);
    return `/login?${p.toString()}`;
  };

  async function accept() {
    setAccepting(true);
    try {
      const res = await acceptInviteByToken(token);
      if (!res.ok) {
        toast.error(res.error ?? "Could not accept the invitation.");
        return;
      }
      setAccepted(true);
      toast.success("You are all set.");
    } finally {
      setAccepting(false);
    }
  }

  const showSpinner = isLoading || authLoading;

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] rounded-[24px] border border-[#e9edef] bg-white p-8 shadow-xl dark:border-[#2a3942] dark:bg-[#202c33]">
        <div className="mb-6 flex justify-center">
          <img src={logoImg} alt="Yakal" className="h-12 object-contain" />
        </div>

        {showSpinner ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-[#1099A1]" />
          </div>
        ) : accepted ? (
          <Success onContinue={() => navigate("/student")} />
        ) : !invite || !invite.valid ? (
          <Invalid reason={invite?.reason ?? "invalid"} signedInEmail={profile?.email ?? null} inviteEmail={invite?.email ?? null} />
        ) : (
          <Valid
            invite={invite}
            user={user}
            profile={profile}
            accepting={accepting}
            onAccept={accept}
            loginHref={loginHref}
          />
        )}
      </div>
    </div>
  );
}

function Valid({
  invite,
  user,
  profile,
  accepting,
  onAccept,
  loginHref,
}: {
  invite: InviteDetails;
  user: { id: string } | null;
  profile: { role: string; email: string | null } | null;
  accepting: boolean;
  onAccept: () => void;
  loginHref: (mode: "login" | "signup") => string;
}) {
  const intro = (
    <>
      <h1 className="text-center text-[22px] font-bold text-[#111] dark:text-white">
        {invite.parentName} invited you to Yakal
      </h1>
      <p className="mt-2 text-center text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
        Accept to link your account to your parent. They can then set up tutoring or college
        admissions for you.
      </p>
    </>
  );

  // Signed out: offer the two ways in, both returning here.
  if (!user) {
    return (
      <>
        {intro}
        <a
          href={loginHref("signup")}
          className="mt-2 block h-12 rounded-xl bg-[#1099A1] text-center text-[15px] font-bold leading-[48px] text-white hover:bg-[#0d7f86]"
        >
          Create my account
        </a>
        <a
          href={loginHref("login")}
          className="mt-3 block h-12 rounded-xl border border-[#1099A1] text-center text-[15px] font-semibold leading-[46px] text-[#1099A1] hover:bg-[#1099A1]/5"
        >
          I already have an account
        </a>
        <p className="mt-4 text-center text-[12px] text-[#8696a0]">
          Use the email this invitation was sent to.
        </p>
      </>
    );
  }

  // Signed in as the wrong kind of account.
  if (profile && profile.role !== "student") {
    return (
      <Notice
        title="Sign in as a student"
        body={`This invitation is for a student account. You are signed in as a ${profile.role}. Sign in with the student account for ${invite.email} to accept it.`}
        cta={{ label: "Use a different account", href: loginHref("login") }}
      />
    );
  }

  // Signed in as a student whose address does not match.
  if (profile && invite.email && profile.email && profile.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Notice
        title="Different email address"
        body={`This invitation was sent to ${invite.email}, but you are signed in as ${profile.email}. Sign in with ${invite.email} to accept it.`}
        cta={{ label: "Use a different account", href: loginHref("login") }}
      />
    );
  }

  // Signed in as the invited student: one click to accept.
  return (
    <>
      {intro}
      <button
        onClick={onAccept}
        disabled={accepting}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1099A1] text-[15px] font-bold text-white hover:bg-[#0d7f86] disabled:opacity-60"
      >
        {accepting ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
        Accept invitation
      </button>
    </>
  );
}

function Success({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#97CE9D]/20 text-[#1099A1]">
        <Check size={28} />
      </div>
      <h1 className="text-[22px] font-bold text-[#111] dark:text-white">You are all set</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
        Your account is linked to your parent. Anything they set up for you will appear here.
      </p>
      <button
        onClick={onContinue}
        className="mt-2 h-12 w-full rounded-xl bg-[#1099A1] text-[15px] font-bold text-white hover:bg-[#0d7f86]"
      >
        Go to my dashboard
      </button>
    </div>
  );
}

function Invalid({
  reason,
  signedInEmail,
  inviteEmail,
}: {
  reason: InviteDetails["reason"];
  signedInEmail: string | null;
  inviteEmail: string | null;
}) {
  // "used" while signed in as the intended child is not really an error: the
  // grant already happened (a fresh signup does it), so send them onward.
  if (reason === "used" && signedInEmail && inviteEmail && signedInEmail.toLowerCase() === inviteEmail.toLowerCase()) {
    return (
      <Notice
        title="You are all set"
        body="This invitation has already been accepted and your access is on."
        cta={{ label: "Go to my dashboard", href: "/student" }}
      />
    );
  }

  const body =
    reason === "used"
      ? "This invitation has already been used."
      : reason === "expired"
        ? "This invitation link has expired. Ask your parent to send a new one."
        : reason === "cancelled"
          ? "This invitation was withdrawn."
          : "This invitation link is not valid.";

  return <Notice title="Invitation unavailable" body={body} />;
}

function Notice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#CAA25F]/15 text-[#CAA25F]">
        <AlertCircle size={28} />
      </div>
      <h1 className="text-[20px] font-bold text-[#111] dark:text-white">{title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">{body}</p>
      {cta ? (
        <Link
          to={cta.href}
          className="mt-5 inline-block h-11 rounded-xl bg-[#1099A1] px-6 text-[14px] font-semibold leading-[44px] text-white hover:bg-[#0d7f86]"
        >
          {cta.label}
        </Link>
      ) : (
        <Link
          to="/"
          className="mt-5 inline-block text-[13.5px] font-medium text-[#1099A1] hover:underline"
        >
          Go to the homepage
        </Link>
      )}
    </div>
  );
}
