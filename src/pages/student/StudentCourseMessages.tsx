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

  const { data: course, isLoading } = useQuery({
    queryKey: ["course-tutor", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, tutor_id, tutor:profiles!courses_tutor_id_fkey(id, full_name, role, avatar_url)")
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
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
