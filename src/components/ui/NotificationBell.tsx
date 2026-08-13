import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/services/notificationService";
import { cn } from "@/utils/cn";

// ============================================================
// Notifications, without leaving the page.
//
// They already had a page of their own, which is the right home for reading
// through them and the wrong one for noticing them: nothing anywhere else said
// there was anything to notice. This is the noticing.
//
// The list is deliberately short. Anything longer than a glance belongs on the
// page, and the link at the bottom is how you get there.
// ============================================================

const SHOWN = 6;

function ago(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell({ basePath }: { basePath: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user?.id,
  });

  // The badge has to be right without a refresh, or it teaches people to
  // ignore it.
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToNotifications(user.id, () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    });
  }, [user?.id, queryClient]);

  // A dropdown that survives a click elsewhere is a dropdown people close by
  // navigating away from the page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const live = notifications.filter((n) => !n.archived);
  const unread = live.filter((n) => !n.isRead).length;

  // Every row goes to the notifications page rather than to whatever the
  // notification points at. The dropdown truncates to one line, so a tap on it
  // is usually "let me read that properly", and jumping straight to a course
  // or an invoice answers a question nobody asked yet.
  const openOne = async (id: string) => {
    setOpen(false);
    await markNotificationRead(id);
    void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    navigate(`${basePath}/notifications`);
  };

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[14px] font-semibold text-foreground">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await markAllNotificationsRead(user!.id);
                  void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
                }}
                className="text-[12.5px] font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {live.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13.5px] text-muted-foreground">
              Nothing new.
            </p>
          ) : (
            <div className="max-h-[380px] overflow-y-auto">
              {live.slice(0, SHOWN).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openOne(n.id)}
                  className={cn(
                    "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/40",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  {/* Unread is a dot rather than a colour on the text, so a
                      read notification is still comfortable to read. */}
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.isRead ? "bg-transparent" : "bg-primary"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-foreground">
                      {n.title}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {n.message}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {ago(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(`${basePath}/notifications`);
            }}
            className="w-full border-t border-border px-4 py-3 text-center text-[13px] font-medium text-primary transition-colors hover:bg-muted/40"
          >
            View all
          </button>
        </div>
      )}
    </div>
  );
}
