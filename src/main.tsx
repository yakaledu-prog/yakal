
  import { createRoot } from "react-dom/client";
  import { AppRouter } from "./app/Router.tsx";
  import { GoogleOAuthProvider } from "@react-oauth/google";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import "./styles/index.css";
  import { applyTheme, preferredTheme } from "./lib/theme";

  // Before the first paint, so a dark user does not get a white flash on the
  // way to their own theme.
  applyTheme(preferredTheme());

  const clientId = import.meta.env.VITE_GCP_CLIENT_ID || "";
  // Server state is TanStack Query's job everywhere in this app. Defaults are
  // set once here rather than per call, and one retry covers a dropped
  // connection without making a genuine failure take four seconds to admit it.
  //
  // The two refetch settings are what decide whether the app feels live.
  // Invalidation after a write only ever reaches the browser that did the
  // writing, so when an admin accepts an application, or a parent books, the
  // other person's cache has no idea anything happened. Refetching when a tab
  // regains focus is what closes that gap without subscribing to every table.
  //
  // Freshness is fifteen seconds rather than a minute for the same reason: a
  // minute meant walking to another page showed a snapshot from before the
  // thing you just did, which reads as the app ignoring you. Short enough to
  // feel current, long enough that moving between two pages does not refetch
  // on every step.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });

  createRoot(document.getElementById("root")!).render(
    <GoogleOAuthProvider clientId={clientId}>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );

// The boot screen in index.html covers the gap between the operating system's
// splash and React's first paint. Faded rather than removed on the same frame,
// so the handover reads as one screen settling instead of two screens swapping.
const boot = document.getElementById("boot");
if (boot) {
  requestAnimationFrame(() => {
    boot.classList.add("done");
    boot.addEventListener("transitionend", () => boot.remove(), { once: true });
  });
}
