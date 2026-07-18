import { useState, useEffect } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { type Conversation, mockConversations } from "@/mock/chatData";
import { useParams } from "react-router-dom";

import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function StudentCourseMessages() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  useEffect(() => {
    // Mock fetching the conversation for the course instructor
    const tutorConv = mockConversations.find(c => c.contact.role === "Tutor") || mockConversations[0];
    if (tutorConv) {
      setConversations([tutorConv]);
      setActiveConv(tutorConv);
    }
  }, [courseId]);

  if (!activeConv) return null;

  return (
    <div className="flex-1 bg-white dark:bg-[#202c33] flex flex-col min-h-0 overflow-hidden relative">
      <ChatPane 
        activeConv={activeConv} 
        setConversations={setConversations} 
        showHeader={false}
        onExpandChat={() => navigate("/student/messages", { state: { tutorName: activeConv.contact.name } })}
      />
    </div>
  );
}
