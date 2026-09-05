import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ChatBody, useDirectConversation } from "@/components/messaging";

// The course page already names the instructor, so this is the conversation on
// its own: no list, no second header.
//
// It used to pick an arbitrary tutor out of mockConversations, so the chat was
// not with the person actually teaching the course.
export function StudentCourseMessages() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Their tutor, not the course's.
  //
  // This read courses.tutor_id, which held one tutor for everybody. A course
  // can carry several now, and a student writing to "the tutor" means the one
  // they are actually taught by, which is the one on their own sessions. The
  // roster is only the fallback, for a student who has bought the course but
  // not yet sat a lesson.
  const { data: course, isLoading } = useQuery({
    queryKey: ["course-tutor", courseId, user?.id],
    queryFn: async () => {
      const { data: courseRow, error } = await supabase
        .from("courses")
        .select(`id, title,
                 roster:course_tutors (created_at,
                   tutor:profiles!course_tutors_tutor_id_fkey (id, full_name, role, avatar_url))`)
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;

      const { data: mine } = await supabase
        .from("sessions")
        .select("tutor_id")
        .eq("course_id", courseId!)
        .eq("student_id", user!.id)
        .order("date", { ascending: false })
        .limit(1);

      const roster = ((courseRow as any)?.roster ?? []).slice().sort((a: any, b: any) => {
        const byTime = String(a.created_at).localeCompare(String(b.created_at));
        return byTime !== 0 ? byTime : String(a.tutor?.id).localeCompare(String(b.tutor?.id));
      });
      const mineId = mine?.[0]?.tutor_id ?? null;
      const tutor =
        roster.find((r: any) => r.tutor?.id === mineId)?.tutor ?? roster[0]?.tutor ?? null;

      return { ...(courseRow as any), tutor };
    },
    enabled: !!courseId && !!user?.id,
  });

  const tutor = (course as any)?.tutor as
    | { id: string; full_name: string | null; role: string | null; avatar_url: string | null }
    | null
    | undefined;

  const { conversation, send, isPeerTyping, notifyTyping } = useDirectConversation({
    userId: user?.id,
    peerId: tutor?.id,
    peerName: tutor?.full_name ?? undefined,
    peerRole: tutor?.role ?? "tutor",
    peerAvatarUrl: tutor?.avatar_url,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={22} />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <p className="text-[14px] text-[#667781] dark:text-[#8696a0]">
          This course has no instructor assigned yet, so there is no one to message.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-[#202c33] flex flex-col min-h-0 overflow-hidden relative">
      <ChatBody
        conversation={conversation}
        currentUserId={user?.id}
        onSendText={send}
        onTyping={notifyTyping}
        isPeerTyping={isPeerTyping}
        onExpand={() =>
          navigate("/student/messages", { state: { openWith: conversation.contact.id } })
        }
      />
    </div>
  );
}
