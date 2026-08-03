import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { cn } from "@/utils/cn";

// ============================================================
// Offering to install the app.
//
// Two paths, because there is no one way to do this. Chrome, Edge and Android
// fire beforeinstallprompt and hand over an object we can call later, so the
// button opens the browser's real install dialogue. Safari fires nothing at
// all and has no API: on an iPhone the only route is Share, then Add to Home
// Screen, so the same button opens instructions instead. Pretending otherwise
// would give iOS users a button that does nothing.
//
// No site can install itself silently. The browser always asks; the most a
// button can do is bring that question up at a moment that makes sense.
//
// The event is caught by an inline script in index.html, before this bundle
// exists, because Chrome fires it early and never fires it again. This module
// picks up what that script stashed.
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

/**
 * How to install by hand, for a browser that will not offer it.
 *
 * Chrome only fires beforeinstallprompt once it decides the site qualifies,
 * and never on a desktop that has already dismissed it, so a button that
 * relies on the event alone is a button that is usually missing. These are the
 * manual routes, which always exist.
 */
function manualSteps(): { where: string; steps: string[] } {
  const ua = window.navigator.userAgent;
  if (isIos()) {
    return { where: "Safari", steps: ["Tap Share at the bottom", "Choose Add to Home Screen"] };
  }
  if (/android/i.test(ua)) {
    return { where: "Chrome", steps: ["Open the menu, top right", "Choose Install app, or Add to Home screen"] };
  }
  if (/firefox/i.test(ua)) {
    return { where: "Firefox", steps: ["Open the menu", "Choose Install"] };
  }
  return {
    where: "your browser",
    steps: ["Look for the install icon in the address bar", "Or open the menu and choose Install Yakal"],
  };
}

function snoozed(): boolean {
  const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  return at > 0 && Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}

// ---- One shared answer, for every component that asks -------------------
//
// The install offer is a property of the page, not of a component. Held per
// component, each copy had to catch the event for itself, and consuming the
// prompt in the floating card left the button in the top bar still believing
// it had one to fire.

interface State {
  deferred: InstallEvent | null;
  installed: boolean;
}

const listeners = new Set<() => void>();

let state: State = {
  // Whatever the inline script caught before this bundle ran.
  deferred: (window as any).__yakalInstallPrompt ?? null,
  installed: isStandalone(),
};

/** getSnapshot must return a stable reference, hence replacing the object. */
function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

// Attached once at module scope rather than per mount. The inline script has
// the head start; these catch an event that arrives afterwards.
window.addEventListener("yakal:installprompt", () => {
  setState({ deferred: (window as any).__yakalInstallPrompt ?? null });
});
window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  setState({ deferred: e as InstallEvent });
});
window.addEventListener("appinstalled", () => {
  setState({ deferred: null, installed: true });
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether to offer an install, and how.
 *
 * `canInstall` means the browser handed us a prompt we can fire. `manual`
 * means iOS, where it never will.
 */
export function useInstallPrompt() {
  const { deferred, installed } = useSyncExternalStore(subscribe, () => state);

  const install = async () => {
    if (!deferred) return false;
    // Called straight out of the click, with no await in front of it. The
    // browser only honours prompt() while a user gesture is still in scope.
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // Single use, whatever they chose. Chrome will fire a fresh event if it
    // decides to offer again.
    (window as any).__yakalInstallPrompt = null;
    setState({ deferred: null });
    return outcome === "accepted";
  };

  return {
    installed,
    canInstall: !!deferred,
    manual: !deferred && isIos() && !installed,
    install,
  };
}

/** Directions, for every browser that will not offer a button of its own. */
function ManualSteps() {
  const { where, steps } = manualSteps();
  return (
    <ol className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          {i === 0 ? (
            <Share size={15} className="shrink-0 text-[#1099A1]" />
          ) : (
            <SquarePlus size={15} className="shrink-0 text-[#1099A1]" />
          )}
          {step}
        </li>
      ))}
      <li className="pt-0.5 text-[12px] opacity-70">In {where}</li>
    </ol>
  );
}

/**
 * A permanent way in, for somebody who wants the app and is looking for it.
 *
 * The banner below only appears when the browser volunteers, which on a
 * desktop is rarely and on an iPhone is never. This is always there while the
 * app is not installed, and falls back to directions when there is no prompt
 * to fire.
 */
export function InstallButton({
  className,
  label = "Install",
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  const { installed, canInstall, install } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (canInstall ? void install() : setShowSteps(true))}
        title="Install Yakal as an app"
        className={cn(
          // Outlined and worded. A bare download glyph in a row of icons is a
          // guess, and nobody guesses at something they were not looking for.
          "flex items-center gap-1.5 rounded-lg border border-[#1099A1]/40 font-medium text-[#1099A1] transition-colors hover:border-[#1099A1] hover:bg-[#1099A1]/5",
          compact ? "px-2.5 py-1.5 text-[12.5px]" : "px-3.5 py-2 text-[13.5px]",
          className
        )}
      >
        <Download size={compact ? 14 : 16} />
        {label}
      </button>

      {showSteps && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSteps(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="How to install Yakal"
            className="w-full max-w-sm rounded-2xl bg-popover p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">Install Yakal</p>
                <p className="text-[13px] text-muted-foreground">
                  It opens without browser tabs and loads instantly.
                </p>
                <ManualSteps />
              </div>
              <button
                type="button"
                onClick={() => setShowSteps(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function InstallPrompt({ className }: { className?: string }) {
  const { installed, canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => snoozed());
  const [showSteps, setShowSteps] = useState(false);
  const [shown, setShown] = useState(false);

  // Held back for a moment, so it slides in after the page has settled rather
  // than being part of the first paint. An offer that is already there when
  // you arrive is furniture; one that arrives is noticed.
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Shown whenever it is not installed, not only when the browser volunteers.
  // Chrome fires beforeinstallprompt on its own schedule and Safari never
  // does, so waiting for it meant the offer was usually absent. Without an
  // event the button opens directions instead.
  if (installed || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-popover p-4 shadow-2xl md:left-auto md:right-6",
        "transition-all duration-500 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
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
          {showSteps && <ManualSteps />}
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
          onClick={() => (canInstall ? void install() : setShowSteps(true))}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1099A1] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
        >
          <Download size={16} />
          {canInstall ? "Install" : "How to install"}
        </button>
      )}
    </div>
  );
}
