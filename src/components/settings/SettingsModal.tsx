import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, Moon, Settings2, Sun, User, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { applyTheme, currentTheme, subscribeToTheme, type Theme } from "@/lib/theme";
import { PushSettings } from "./PushSettings";

// ============================================================
// Settings, as a modal.
//
// It was a page, on three of the five roles, linked from exactly one button on
// the counsellor's home. Everything on it was invented: a "Demo User" with a
// demo@yakal.test address in inputs that saved nowhere, two notification
// checkboxes wired to nothing, and a dark mode toggle that reached past the
// theme system and so did not survive a reload.
//
// A modal because none of this is a destination. Somebody comes here to change
// one thing and go back to what they were doing, and a page makes them
// navigate away from it and find their way back.
//
// The open tab is in the URL, so a link can point at one, the back button
// closes it, and a reload does not lose your place. ChatGPT keeps this in
// component state and pays for it on every refresh.
// ============================================================

type TabId = "general" | "account" | "billing";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "account", label: "Account", icon: User },
  { id: "billing", label: "Billing", icon: CreditCard },
];

/** The query parameter that opens it. Exported so the entry points agree. */
export const SETTINGS_PARAM = "settings";

export function SettingsModal() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const raw = params.get(SETTINGS_PARAM);
  const open = raw !== null;
  const tab = (TABS.some((t) => t.id === raw) ? raw : "general") as TabId;

  // Escape closes it, which is the one keyboard convention every modal owes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while this is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function close() {
    const next = new URLSearchParams(params);
    next.delete(SETTINGS_PARAM);
    setParams(next, { replace: true });
  }

  function goTo(id: TabId) {
    const next = new URLSearchParams(params);
    next.set(SETTINGS_PARAM, id);
    setParams(next, { replace: true });
  }

  const role = profile?.role ?? "student";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4"
      // Only the backdrop itself, so a click that started inside and ended out
      // here does not close it mid-drag.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Sized to its content rather than to a fixed 620px. There are three
          tabs and a handful of rows, so a tall box was mostly empty and the
          close button sat a long way from anything. A floor stops it jumping
          about as tabs of different lengths are opened. */}
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21] sm:h-auto sm:max-h-[85vh] sm:min-h-[340px] sm:max-w-2xl sm:rounded-2xl md:flex-row">
        {/* Left rail. Above the panel on a phone, beside it on a desktop, and
            it scrolls sideways rather than wrapping so the panel keeps its
            height on a narrow screen. */}
        <aside className="flex shrink-0 flex-col border-b border-[#e9edef] bg-[#f7f7f7] dark:border-[#2a3942] dark:bg-[#182329] md:w-48 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-4 pt-4 md:px-5">
            <h2 className="text-[17px] font-semibold text-[#111] dark:text-white">Settings</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 md:hidden"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex gap-1 overflow-x-auto p-3 [scrollbar-width:none] md:flex-col md:overflow-visible [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => goTo(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition-colors",
                  tab === id
                    ? "bg-white font-medium text-[#111] dark:bg-[#2a3942] dark:text-white"
                    : "text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/5"
                )}
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="hidden items-center justify-end px-5 pt-4 md:flex">
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 md:px-6">
            {tab === "general" && <GeneralTab />}
            {tab === "account" && (
              <AccountTab
                name={profile?.full_name ?? null}
                email={profile?.email ?? user?.email ?? null}
                avatarUrl={profile?.avatar_url ?? null}
                role={role}
                onNavigate={(to) => {
                  close();
                  navigate(to);
                }}
              />
            )}
            {tab === "billing" && <BillingTab role={role} onClose={close} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A labelled row, so every setting sits on the same grid. */
function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#e9edef] py-4 last:border-0 dark:border-[#2a3942]">
      <div className="min-w-0">
        <p className="text-[14.5px] text-[#111] dark:text-white">{label}</p>
        {description && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-[15px] font-semibold text-[#111] dark:text-white">{children}</h3>
  );
}

function GeneralTab() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // The sidebar has its own toggle, so this has to follow it rather than hold
  // a copy of the answer.
  useEffect(() => subscribeToTheme(setTheme), []);

  return (
    <section>
      <SectionTitle>General</SectionTitle>
      <Row label="Appearance" description="Applies to this browser and travels with your account.">
        <div className="flex items-center gap-1 rounded-lg bg-[#f0f2f5] p-1 dark:bg-[#2a3942]">
          {([
            ["light", Sun, "Light"],
            ["dark", Moon, "Dark"],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                theme === value
                  ? "bg-white text-[#111] shadow-sm dark:bg-[#111b21] dark:text-white"
                  : "text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </Row>

      {/* Here rather than on a tab of its own. There is one notification
          setting, push, because in-app and email are not switchable: nothing
          records a preference for them and inventing a column to hold one
          would be building a feature to fill a panel. */}
      <PushSettings />
    </section>
  );
}

function AccountTab({
  name,
  email,
  avatarUrl,
  role,
  onNavigate,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <section>
      <SectionTitle>Account</SectionTitle>

      <div className="flex items-center gap-4 border-b border-[#e9edef] py-4 dark:border-[#2a3942]">
        <img
          src={avatarUrl || dicebearUrl(name || "user")}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-[#111] dark:text-white">
            {name || "Your account"}
          </p>
          <p className="truncate text-[13px] text-[#54656f] dark:text-[#aebac1]">{email || ""}</p>
          <p className="mt-0.5 text-[12.5px] capitalize text-[#54656f] dark:text-[#aebac1]">{role}</p>
        </div>
      </div>

      {/* Editing lives on the profile page, which already does it properly.
          Duplicating the form here would be a second place that writes a
          profile, and the two would disagree the first time one changed. */}
      <Row label="Your profile" description="Photo, name, and everything families see.">
        <button
          type="button"
          onClick={() => onNavigate(`/${role}/profile`)}
          className="rounded-lg border border-[#e9edef] px-3.5 py-2 text-[13px] font-medium text-[#111] transition-colors hover:bg-muted/60 dark:border-[#2a3942] dark:text-white"
        >
          Open profile
        </button>
      </Row>

      <Row label="Password" description="Sign out and use the reset link to change it.">
        <Link
          to="/forgot-password"
          className="rounded-lg border border-[#e9edef] px-3.5 py-2 text-[13px] font-medium text-[#111] transition-colors hover:bg-muted/60 dark:border-[#2a3942] dark:text-white"
        >
          Reset password
        </Link>
      </Row>
    </section>
  );
}

/**
 * Where money lives, which is somewhere different for each role.
 *
 * A parent pays and sees invoices; a tutor and a counsellor are paid and see
 * earnings; a student is neither and has nothing here to look at, which is
 * worth saying rather than showing them an empty panel.
 */
function BillingTab({ role, onClose }: { role: string; onClose: () => void }) {
  const destination =
    role === "parent"
      ? { to: "/parent/billing", label: "Open billing", blurb: "Your plans, invoices and the card they are charged to." }
      : role === "tutor" || role === "counselor"
        ? { to: `/${role}/earnings`, label: "Open earnings", blurb: "What you have earned, what is still held, and your bank details." }
        : role === "admin"
          ? { to: "/admin/billing", label: "Open billing", blurb: "Every invoice and plan on the platform." }
          : null;

  return (
    <section>
      <SectionTitle>Billing</SectionTitle>
      {destination ? (
        <Row label="Payments" description={destination.blurb}>
          <Link
            to={destination.to}
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {destination.label}
          </Link>
        </Row>
      ) : (
        <p className="py-4 text-[13.5px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
          Nothing is billed to your account. A parent pays for the courses and counselling on it,
          and can see every invoice from their own.
        </p>
      )}
    </section>
  );
}

/** So the sidebar and anything else open it the same way. */
export function settingsHref(tab: TabId = "general"): string {
  return `?${SETTINGS_PARAM}=${tab}`;
}
