import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getLinkedStudentConversations, type ParentConversationView } from "@/services/messageService";
import { avatarUrl } from "@/components/chat/ChatPane";
import { Eye, Loader2, MessagesSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/utils/cn";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function ParentChildChats() {
  const { user } = useAuth();
  const { data: convos = [], isLoading } = useQuery({
    queryKey: ["parent-child-chats", user?.id],
    queryFn: () => getLinkedStudentConversations(user!.id),
    enabled: !!user?.id,
  });

  const [activeId, setActiveId] = useState<string>("");
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  useEffect(() => {
    if (!activeId && convos.length > 0) setActiveId(convos[0].id);
  }, [convos, activeId]);

  const active = convos.find((c) => c.id === activeId);

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] flex flex-col">
        <div className="bg-[#1099A1] text-white p-6 md:p-10 shrink-0">
          <div className="max-w-[1440px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-1">Children's Chats</h1>
            <p className="text-white/80 text-[15px] flex items-center gap-1.5"><Eye size={15} /> Read-only monitoring of your children's conversations</p>
          </div>
        </div>

        <div className="flex-1 max-w-[1440px] mx-auto w-full bg-white dark:bg-[#111b21] border-x border-[#e9edef] dark:border-[#2a3942] overflow-hidden flex flex-col md:flex-row min-h-0 shadow-sm">
          {/* List */}
          <div className={cn("w-full md:w-[340px] flex-shrink-0 flex-col border-r border-[#e9edef] dark:border-[#2a3942]", showChatOnMobile ? "hidden md:flex" : "flex")}>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#1099A1]" /></div>
              ) : convos.length === 0 ? (
                <p className="px-4 py-8 text-[13px] text-[#667781] dark:text-[#8696a0] text-center">No conversations to show yet.</p>
              ) : (
                convos.map((c) => {
                  const last = c.messages[c.messages.length - 1];
                  return (
                    <div key={c.id} onClick={() => { setActiveId(c.id); setShowChatOnMobile(true); }}
                      className={cn("flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors", c.id === activeId ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]")}>
                      <img src={c.contact.avatar || avatarUrl(c.contact.id)} alt={c.contact.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                      <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[15px] font-medium text-[#111] dark:text-[#e9edef] truncate">{c.contact.name}</span>
                          <span className="text-[11px] text-[#667781] dark:text-[#8696a0] capitalize shrink-0 ml-1">{c.contact.role}</span>
                        </div>
                        <p className="text-[12px] text-[#1099A1] font-medium truncate">{c.childName}</p>
                        <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">{last ? last.content : "No messages"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Transcript (read-only) */}
          <div className={cn("flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]", !showChatOnMobile ? "hidden md:flex" : "flex")}>
            {active ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942]">
                  <button className="md:hidden text-[#54656f] dark:text-[#aebac1]" onClick={() => setShowChatOnMobile(false)}><ArrowLeft size={20} /></button>
                  <img src={active.contact.avatar || avatarUrl(active.contact.id)} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-[#111] dark:text-[#e9edef] truncate">{active.contact.name}</h2>
                    <p className="text-[12px] text-[#667781] dark:text-[#8696a0] truncate">{active.childName} · {active.contact.role}</p>
                  </div>
                </div>

                <ParentTranscript convo={active} />

                <div className="px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942] text-center text-[12px] text-[#667781] dark:text-[#8696a0] flex items-center justify-center gap-1.5">
                  <Eye size={13} /> Read-only - parents can view but not send messages
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                <MessagesSquare size={40} className="text-[#aebac1]" />
                <p className="text-[15px] font-semibold text-[#111] dark:text-white">Select a conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function ParentTranscript({ convo }: { convo: ParentConversationView }) {
  return (
    <div className="flex-1 overflow-y-auto px-[5%] py-4 space-y-2">
      {convo.messages.length === 0 ? (
        <p className="text-center text-[13px] text-[#667781] dark:text-[#8696a0] py-10">No messages in this conversation yet.</p>
      ) : (
        convo.messages.map((m) => {
          const fromChild = m.sender_id === convo.childId;
          return (
            <div key={m.id} className={cn("flex", fromChild ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] rounded-lg px-3 py-2 text-[14px] shadow-sm",
                fromChild ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111] dark:text-white" : "bg-white dark:bg-[#202c33] text-[#111] dark:text-[#e9edef]")}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-0.5">{fmtTime(m.created_at)}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
