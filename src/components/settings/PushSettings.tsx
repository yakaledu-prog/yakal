import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import {
  disablePush,
  enablePush,
  getPushState,
  watchForSubscriptionChange,
  type PushState,
} from "@/services/pushService";

// ============================================================
// The notification setting.
//
// One setting, because there is one that means anything. In-app notifications
// and email are not switchable: nothing on the account records a preference
// for either, and adding a column to hold one so that this panel has three
// rows instead of one would be building a feature to fill a space. The old
// settings page did the other thing, and carried an "Email Notifications" and
// an "SMS Alerts" checkbox, both wired to nothing and both ticked.
//
// Permission is per browser, which is a browser rule rather than a choice we
// made, so the description says so once instead of the label repeating it.
// ============================================================

function Switch({
  on,
  busy,
  onClick,
  label,
}: {
  on: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
        on ? "bg-primary" : "bg-[#c9d1d6] dark:bg-[#3b4a54]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      >
        {busy && <Loader2 size={11} className="animate-spin text-primary" />}
      </span>
    </button>
  );
}

export function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
    // A browser can rotate a subscription without asking. Left alone, the old
    // endpoint starts failing and the device goes quiet with nothing to see.
    return watchForSubscriptionChange();
  }, []);

  const on = state === "subscribed";

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setState("unsubscribed");
      } else {
        const res = await enablePush();
        setState(res.state);
        if (!res.ok) toast.error(res.error ?? "Could not turn those on.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not change that.");
    } finally {
      setBusy(false);
    }
  }

  // Nothing to offer, so nothing is shown. A disabled switch with an
  // explanation underneath is worse than the absence of a switch.
  if (state === null || state === "unsupported" || state === "unconfigured") return null;

  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#e9edef] py-4 last:border-0 dark:border-[#2a3942]">
      <div className="min-w-0">
        <p className="text-[14.5px] text-[#111] dark:text-white">Push notifications</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
          {state === "denied"
            ? "Blocked for this site. Allow notifications in your browser settings, then reload."
            : "A lesson moved or an essay reviewed, while you are somewhere else. Each browser is turned on separately."}
        </p>
      </div>
      {state !== "denied" && (
        <Switch on={on} busy={busy} onClick={() => void toggle()} label="Push notifications" />
      )}
    </div>
  );
}
