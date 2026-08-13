import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { unsubscribeFromNewsletter } from "@/services/newsletterService";

/**
 * The page the unsubscribe link in every newsletter lands on.
 *
 * It acts on arrival rather than asking for a confirmation click. Somebody
 * here has already decided, and a mail client that pre-fetches the link is not
 * a risk worth a second step: the worst it does is unsubscribe someone who was
 * about to anyway, and resubscribing is the same form they used the first time.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!token) return setState("failed");
    let alive = true;
    unsubscribeFromNewsletter(token).then((res) => {
      if (!alive) return;
      setState(res.error ? "failed" : "done");
    });
    return () => { alive = false; };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        {state === "working" && (
          <>
            <Loader2 className="mx-auto animate-spin text-primary" />
            <p className="mt-4 text-[14px] text-muted-foreground">Removing you from the list...</p>
          </>
        )}

        {state === "done" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">You are unsubscribed</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              You will not get the Yakal newsletter again. Anything about a session or
              a payment still reaches you, because that is not this list.
            </p>
          </>
        )}

        {state === "failed" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">That link did not work</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              It may have already been used. If you are still getting the newsletter,
              reply to one and we will take you off by hand.
            </p>
          </>
        )}

        <Link to="/" className="mt-6 inline-block text-[14px] text-primary hover:text-primary-hover">
          Back to Yakal
        </Link>
      </div>
    </div>
  );
}
