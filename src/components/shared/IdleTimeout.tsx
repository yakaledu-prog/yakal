import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ============================================================
// Sign a signed-in account out after a stretch of no interaction.
//
// The dashboard holds billing and payment details, children's records and
// message history, so a session left open on a shared or walked-away-from
// machine is a real exposure. After this long with no activity we clear the
// Supabase token and send the person to /login.
//
// The redirect is mostly automatic: signOut() clears the token, which fires
// onAuthStateChange in AuthProvider, and ProtectedRoute then bounces a routeless
// user to /login. We navigate explicitly as well so it is immediate and works
// even from a public page a signed-in user happens to be on.
// ============================================================

const IDLE_LIMIT_MS = 15 * 60 * 1000;

// Said in the toast, so the message cannot drift from the limit. It did: the
// timeout moved from three minutes to fifteen and the toast still told people
// three, which is the sort of thing that gets reported as a bug in the timer.
const IDLE_LIMIT_MINUTES = Math.round(IDLE_LIMIT_MS / 60_000);
const IDLE_LIMIT_LABEL = `${IDLE_LIMIT_MINUTES} ${IDLE_LIMIT_MINUTES === 1 ? "minute" : "minutes"}`;

// Written on activity so every open tab shares one clock. Without it a second
// tab left idle would sign the whole session out from under a tab you are
// actively working in, because the Supabase token is shared across tabs.
const ACTIVITY_KEY = "yakal:last-activity";

// Passive so scrolling stays smooth; capture phase so a child that calls
// stopPropagation cannot hide the interaction from us.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
] as const;
const LISTENER_OPTS: AddEventListenerOptions = { passive: true, capture: true };

export function IdleTimeout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return; // nothing to protect while signed out

    // When the session is allowed to lapse. Refs would do, but the effect is
    // re-created only on sign in/out, so plain closures over these are fine.
    let expiresAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastWrite = 0;
    let signingOut = false;

    const signOut = async () => {
      if (signingOut) return;
      signingOut = true;
      // Toaster lives in the always-mounted root layout, so this survives the
      // navigation and explains the sudden trip to the login screen.
      toast.info(`Signed out after ${IDLE_LIMIT_LABEL} of inactivity.`);
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    };

    const arm = () => {
      if (timer) clearTimeout(timer);
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        void signOut();
        return;
      }
      // Re-measure against the wall clock rather than trusting one long timer:
      // a background tab throttles setTimeout, so a single long timer can fire
      // late. Rescheduling for the time actually left keeps it honest.
      timer = setTimeout(arm, remaining);
    };

    const extend = (from: number) => {
      expiresAt = from + IDLE_LIMIT_MS;
      arm();
    };

    const onActivity = () => {
      const now = Date.now();
      // A mousemove fires dozens of times a second; all we need is to know this
      // second had activity.
      if (now - lastWrite < 1000) {
        expiresAt = now + IDLE_LIMIT_MS;
        return;
      }
      lastWrite = now;
      extend(now);
      // Tell the other tabs someone is here. Only fires at most once a second.
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // Private-mode or storage-full: the in-tab timer still works, we just
        // lose cross-tab sharing. Not worth failing the app over.
      }
    };

    // Activity in another tab keeps this one alive too.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return;
      const other = Number(e.newValue);
      if (Number.isFinite(other) && other + IDLE_LIMIT_MS > expiresAt) extend(other);
    };

    // A tab hidden past the limit should log out the instant it is looked at
    // again, not whenever the throttled timer happens to catch up.
    const onVisible = () => {
      if (document.visibilityState === "visible") arm();
    };

    // Signing in (this effect mounting) is itself deliberate activity, so the
    // clock starts a full window from now. A stored timestamp is only honoured
    // when it is still within the limit: that is the "second tab of an already
    // active session" case, where resetting a part-way-to-idle session would be
    // wrong. A stale timestamp from an earlier session must NOT be honoured.
    //
    // The previous `Math.max(stored, now - LIMIT)` did exactly that: a stale
    // stored value clamped the start to one full limit ago, so expiresAt landed
    // on now and the user was signed out the instant they signed in (and again
    // on the next attempt, since the idle sign-out leaves the key behind). The
    // key lives in localStorage, which outlives both logout and the
    // sessionStorage session, so on any returning sign-in it is stale.
    const stored = Number(localStorage.getItem(ACTIVITY_KEY));
    const recent = Number.isFinite(stored) && stored > Date.now() - IDLE_LIMIT_MS;
    const start = recent ? stored : Date.now();
    lastWrite = Date.now();
    // Broadcast the fresh session to other tabs when we did not adopt a recent
    // timestamp, so a second tab does not later read a stale one.
    if (!recent) {
      try {
        localStorage.setItem(ACTIVITY_KEY, String(lastWrite));
      } catch {
        // Private-mode or storage-full: the in-tab timer still works.
      }
    }
    extend(start);

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, LISTENER_OPTS));
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, LISTENER_OPTS));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, navigate]);

  return null;
}
