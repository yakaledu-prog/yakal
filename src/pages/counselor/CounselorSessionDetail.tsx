import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Video, Loader2, ChevronLeft, CalendarDays, Clock } from "lucide-react";
import { getSessionById } from "@/services/counselorService";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

/**
 * One advising session.
 *
 * This page used to be a design mockup wired to a route: it took no props, ran
 * no query and never read its own :id, so every session a counselor opened
 * showed the same invented one, down to a colleague called "Dr. Alex" from
 * "Mathematics Dept." with a stock photograph. Everything here is the row now.
 */
export function CounselorSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => getSessionById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl py-20 text-center">
        <p className="text-[15px] font-medium text-foreground">That session no longer exists.</p>
        <button
          onClick={() => navigate("/counselor/sessions")}
          className="mt-3 text-[13.5px] text-primary hover:underline"
        >
          Back to sessions
        </button>
      </div>
    );
  }

  const starts = new Date(`${session.date}T${session.start_time}`);
  const ends = new Date(starts.getTime() + (session.duration_minutes || 60) * 60_000);
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // The status the row carries, said the way a person would.
  const STATUS: Record<string, string> = {
    upcoming: "Upcoming",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button
        onClick={() => navigate("/counselor/sessions")}
        className="flex items-center gap-1 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} /> Sessions
      </button>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p
            className={cn(
              "mb-1 text-[12px] font-semibold uppercase tracking-wider",
              session.status === "cancelled" ? "text-secondary" : "text-primary"
            )}
          >
            {STATUS[session.status] ?? session.status}
          </p>
          <h2 className="text-3xl font-bold tracking-tight">{session.subject || "Advising session"}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              {starts.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {time(starts)} to {time(ends)}
            </span>
          </div>
        </div>

        {/* Only while there is something to join. A finished or cancelled
            session offering a meeting link is a door to an empty room. */}
        {session.status === "upcoming" && (
          <Button
            onClick={() => navigate(`/counselor/meeting/${session.id}`)}
            className="gap-2 bg-primary text-white hover:bg-primary-hover"
          >
            <Video size={18} /> Join meeting
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {session.notes ? (
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                  {session.notes}
                </p>
              ) : (
                <p className="text-[14px] text-muted-foreground">
                  Nothing written yet. Notes added after the session appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <img
                src={session.student_avatar || dicebearUrl(session.student_name || "student")}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <h4 className="truncate font-medium">{session.student_name}</h4>
                <p className="text-xs text-muted-foreground">
                  {session.duration_minutes || 60} minute session
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
