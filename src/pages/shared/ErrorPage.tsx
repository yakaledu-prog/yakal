import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import bugFixing from "@/assets/images/bug-fixing-60.png";

// ============================================================
// What a visitor sees when something breaks.
//
// Three entry points onto one screen:
//
//   ErrorPage        the router's errorElement, for anything thrown while a
//                    route renders or loads
//   AppErrorBoundary a class boundary around the whole tree, for renders that
//                    happen outside a route, and for the router itself
//   ErrorScreen      the screen both of them draw
//
// A route errorElement alone is not enough. React Router only catches what a
// route throws, so an error in a provider above the router, or in the router's
// own setup, still reached the browser as a blank page with a stack trace.
//
// Nothing technical is shown. The exception is logged to the console, where
// whoever can act on it will look; on the screen it would only tell a parent
// that the problem is real and not theirs to solve.
// ============================================================

/**
 * A page's code failed to download rather than failed to run.
 *
 * Chunks are hashed per build, so a deploy that lands while somebody has the
 * app open leaves them asking for files that no longer exist. It reads as a
 * crash and is fixed by fetching the new build, which is worth saying plainly
 * rather than showing them a stack trace.
 */
function isStaleBuild(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unexpected token '<'/i.test(
    message
  );
}

/**
 * Reload past anything cached.
 *
 * The service worker precaches the shell, so on a stale build an ordinary
 * refresh can be served the very files that are failing. Clearing the worker
 * and its caches first makes the reload actually reach the network.
 */
async function hardReload() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Best effort. A reload that skips the cache clean still beats no reload.
  }
  window.location.reload();
}

function describe(error: unknown): { title: string; detail: string; status?: number } {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        status: 404,
        title: "We cannot find that page",
        detail: "The link may be out of date, or the page may have moved.",
      };
    }
    return {
      status: error.status,
      title: "That request did not go through",
      detail: error.data?.message || error.statusText || `Error ${error.status}`,
    };
  }
  if (isStaleBuild(error)) {
    return {
      title: "A new version is available",
      detail: "This page was updated while you had it open. Reloading will pick up the new version.",
    };
  }
  return {
    title: "Something went wrong",
    detail: "This is our fault, not yours. Reloading the page usually clears it.",
  };
}

export function ErrorScreen({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, detail, status } = describe(error);
  const stale = isStaleBuild(error);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-card border border-border rounded-2xl shadow-sm p-8 max-w-md w-full">
        {stale ? (
          <div className="w-16 h-16 flex items-center justify-center rounded-full mx-auto mb-6 bg-primary/10 text-primary">
            <RefreshCw size={30} />
          </div>
        ) : (
          <img
            src={bugFixing}
            alt=""
            className="w-[132px] h-[132px] mx-auto mb-4 object-contain select-none"
            draggable={false}
          />
        )}

        <h1 className="text-[22px] font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground text-[14px] leading-relaxed">{detail}</p>

        <div className="flex flex-col gap-3 mt-8">
          {status === 404 ? null : (
            <Button
              className="w-full !h-12 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl flex items-center justify-center gap-2"
              onClick={() => (stale ? void hardReload() : onRetry ? onRetry() : window.location.reload())}
            >
              <RefreshCw size={18} /> {stale ? "Reload" : "Try again"}
            </Button>
          )}
          {/* A plain anchor, not a router Link. This screen also renders when
              the crash was above the router, where there is no navigation
              context and a Link would throw inside the error handler. */}
          <a href="/" className="block">
            <Button
              variant="outline"
              className="w-full !h-12 font-bold rounded-xl hover:scale-[0.99] transition ease-in-out flex items-center justify-center gap-2"
            >
              <Home size={18} /> Go home
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

/** The router's errorElement. */
export function ErrorPage() {
  const error = useRouteError();
  console.error(error);
  return <ErrorScreen error={error} />;
}

/**
 * Catches render errors anywhere below it, including above the router.
 *
 * Note what this cannot catch, because no React boundary can: errors thrown
 * inside event handlers, timeouts or promise callbacks. Those never break the
 * render, so the app keeps working and the toast on the failing action is the
 * right place to report them.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown }
> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          error={this.state.error}
          // Clearing the error retries the render. If the cause has not gone
          // away it lands straight back here, which is honest.
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
