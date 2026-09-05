import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
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
// Turning push on for this browser.
//
// One button, and it says which of the two things it does. Everything about
// this is per browser rather than per account: somebody with a laptop and a
// phone turns it on twice, and turning it off here leaves the other alone,
// which is what "this browser" in the label is doing.
//
// It renders nothing at all where it cannot work, rather than showing a
// disabled control and explaining. On a browser with no Push API, or a
// deployment with no VAPID key, the honest amount of interface is none.
// ============================================================

export function PushToggle({ className }: { className?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
    // A browser can rotate a subscription without asking. Left alone the old
    // endpoint starts failing and the device goes quiet with nothing to see.
    return watchForSubscriptionChange();
  }, []);

  // Not yet known, or nowhere to show it.
  if (state === null || state === "unsupported" || state === "unconfigured") return null;

  if (state === "denied") {
    return (
      <p className={cn("text-[12.5px] text-white/70", className)}>
        Notifications are blocked for this site in your browser settings.
      </p>
    );
  }

  const on = state === "subscribed";

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setState("unsubscribed");
        toast.success("This browser will stop showing notifications.");
      } else {
        const res = await enablePush();
        setState(res.state);
        if (res.ok) toast.success("This browser will now show notifications.");
        else toast.error(res.error ?? "Could not turn those on.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not change that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-white/25 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60",
        className
      )}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : on ? (
        <BellOff size={14} />
      ) : (
        <Bell size={14} />
      )}
      {on ? "Turn off on this browser" : "Notify me on this browser"}
    </button>
  );
}
