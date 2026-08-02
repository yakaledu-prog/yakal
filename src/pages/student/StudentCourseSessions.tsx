import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  PastSessions,
  UpcomingSessions,
  useSessionExtras,
  type SessionListItem,
} from "@/components/shared/SessionList";
import { RateSessionDialog } from "@/components/shared/RateSessionDialog";
import {
  RescheduleDialog,
  type ReschedulableSession,
} from "@/components/shared/RescheduleDialog";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseSessions } from "@/services/studentService";

// The rows are the shared session lists, so a session reads the same here as
// anywhere else. What is specific to a student is the action on the right:
// join the one happening today, ask to move a later one.

export function StudentCourseSessions() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [moving, setMoving] = useState<ReschedulableSession | null>(null);
  // Rating belongs to the student, so it is offered here and nowhere a tutor
  // or a parent is looking: they are not the ones with an opinion to give.
  const [rating, setRating] = useState<SessionListItem | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["course-sessions", user?.id, courseId],
    queryFn: () => getCourseSessions(user!.id, courseId!),
    enabled: !!user?.id && !!courseId,
  });

  const { data: extras } = useSessionExtras(rows);

  const sessions: SessionListItem[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    startTime: r.start_time,
    durationMinutes: r.duration_minutes,
    status: r.status,
    title: r.subject,
    personName: r.tutor_name,
    personAvatarUrl: r.tutor_avatar,
    rating: extras?.ratings[r.id] ?? null,
    attendedMinutes: extras?.minutes[r.id] ?? null,
  }));

  const toReschedulable = (s: SessionListItem): ReschedulableSession => ({
    id: s.id,
    title: s.title,
    date: s.date,
    startTime: s.startTime,
    tutorId: rows.find((r) => r.id === s.id)?.tutor_id ?? null,
    studentId: user?.id ?? null,
  });

  return (
    <div className="p-4 md:p-8">
      {/* One list, in the order a student reads it: what is next, then what
          has been. Both parts share the same dividers, so the seam does not
          show and the tab above does not need repeating as a heading. */}
      {!isLoading && sessions.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-muted-foreground">
          No sessions booked for this course yet.
        </p>
      ) : (
        <>
          <UpcomingSessions
            sessions={sessions}
            isLoading={isLoading}
            hideIfEmpty
            onJoin={(s) => navigate(`/student/meeting/${s.id}`)}
            onReschedule={(s) => setMoving(toReschedulable(s))}
          />
          <PastSessions sessions={sessions} hideIfEmpty onRate={setRating} />
        </>
      )}

      {moving && <RescheduleDialog session={moving} onClose={() => setMoving(null)} />}

      {rating && (
        <RateSessionDialog
          sessionId={rating.id}
          tutorId={rows.find((r) => r.id === rating.id)?.tutor_id ?? ""}
          tutorName={rating.personName ?? "Your tutor"}
          tutorAvatarUrl={rating.personAvatarUrl}
          subject={rating.title}
          startsAt={new Date(`${rating.date}T${rating.startTime}`)}
          durationMinutes={rating.durationMinutes}
          onClose={() => setRating(null)}
        />
      )}
    </div>
  );
}
