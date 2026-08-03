import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { cn } from "@/utils/cn";

// ============================================================
// Offering to install the app.
//
// Two paths, because there is no one way to do this. Chrome, Edge and Android
// fire beforeinstallprompt and hand over an object we can call later, so the
// button is real. Safari fires nothing at all and has no API: on an iPhone the
// only route is Share, then Add to Home Screen, so the same button opens
// instructions instead. Pretending otherwise would give iOS users a button
// that does nothing.
//
// Nothing is shown to somebody who already installed it, and a dismissal is
// remembered. An install banner that reappears every visit is an advert.
// ============================================================

const DISMISSED_KEY = "yakal.install.dismissed";
/** Long enough that a "not now" is respected, short enough to ask again. */
const SNOOZE_DAYS = 30;

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Already installed, or opened from the home screen. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag, which predates the standard and is still the only
    // way to tell on an iPhone.
    (window.navigator as any).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function snoozed(): boolean {
  const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  return at > 0 && Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Whether to offer an install, and how.
 *
 * `deferred` is the browser's own prompt where there is one. `manual` means
 * iOS, where there is not.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Chrome shows its own mini-infobar otherwise, at a moment we did not
      // choose. Holding the event lets the offer sit where it makes sense.
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single use, whatever they chose.
    setDeferred(null);
    return outcome === "accepted";
  };

  return {
    installed,
    canInstall: !!deferred,
    manual: !deferred && isIos() && !installed,
    install,
  };
}

/** The iPhone route, which is a set of directions rather than a button. */
function IosSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
      <li className="flex items-center gap-2">
        <Share size={15} className="shrink-0 text-[#1099A1]" />
        Tap Share at the bottom of Safari
      </li>
      <li className="flex items-center gap-2">
        <SquarePlus size={15} className="shrink-0 text-[#1099A1]" />
        Choose Add to Home Screen
      </li>
    </ol>
  );
}

export function InstallPrompt({ className }: { className?: string }) {
  const { installed, canInstall, manual, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => snoozed());
  const [showSteps, setShowSteps] = useState(false);

  if (installed || dismissed || (!canInstall && !manual)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-popover p-4 shadow-2xl md:left-auto md:right-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-foreground">Install Yakal</p>
          <p className="text-[13px] text-muted-foreground">
            Opens like an app, and loads instantly.
          </p>
          {showSteps && <IosSteps />}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <X size={17} />
        </button>
      </div>

      {!showSteps && (
        <button
          type="button"
          onClick={() => (manual ? setShowSteps(true) : void install())}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1099A1] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
        >
          <Download size={16} />
          {manual ? "How to install" : "Install"}
        </button>
      )}
    </div>
  );
}
