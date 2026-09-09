import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { SESSION_EXPIRED_EVENT } from "@/lib/authedFetch";
import { useAuth } from "@/contexts/AuthContext";

// ============================================================
// An expired session sends you to sign in, rather than telling you it expired.
//
// It used to be a message inside whatever you were doing. Changing a plan put
// "Your session has expired. Please sign in again." in the modal, above a
// Confirm button that could never work again, and left you to work out that
// the cure was a reload. Nothing on the page offered to do it, and the words
// were the only part of the app that knew.
//
// So the app does it: sign out, and go to the login screen carrying where you
// were, so signing in puts you back rather than on your dashboard. That last
// part is why this is a component and not a redirect inside authedFetch,
// which has no idea what page it was called from.
// ============================================================

export function SessionExpiry() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Where they were, read through a ref so the listener does not have to be
  // torn down and rebuilt on every navigation.
  //
  // Written in an effect, not during render: a render can be thrown away and
  // re-run, and a ref written during one is a write that may never have
  // happened. The listener only reads it when something has already failed,
  // which is long after the effect has run.
  const from = useRef(location);
  useEffect(() => {
    from.current = location;
  }, [location]);

  // A page can fire several requests at once, and a dead session fails all of
  // them. Without this they each sign out and navigate, which stacks toasts
  // and races the redirect against itself.
  const handling = useRef(false);

  useEffect(() => {
    const onExpired = async () => {
      if (handling.current) return;
      handling.current = true;

      // Nobody was signed in to begin with, so there is no session to have
      // expired and nothing worth interrupting them for.
      if (!user) {
        handling.current = false;
        return;
      }

      toast.info("Your session expired. Please sign in again.");
      await supabase.auth.signOut();

      // AuthPage already honours ?next=, which is how an invite link brings
      // somebody back to the invite. The same parameter brings them back here.
      const back = `${from.current.pathname}${from.current.search}`;
      navigate(`/login?next=${encodeURIComponent(back)}`, { replace: true });

      // Released after the navigation, so a burst of failures from the page
      // being left behind is still treated as one expiry.
      window.setTimeout(() => {
        handling.current = false;
      }, 2000);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate, user]);

  return null;
}
