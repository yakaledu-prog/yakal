import { useState } from "react";
import { Search, MoreHorizontal, Paperclip, Image as ImageIcon, Smile, Send } from "lucide-react";
import { mockContacts, currentUserId, Contact } from "@/mock/chatData";
import { cn } from "@/utils/cn";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function StudentMessages() {
  const [activeTab, setActiveTab] = useState<"Active" | "Inactive">("Active");
  const [selectedContact, setSelectedContact] = useState<Contact>(mockContacts[0]);
  const [message, setMessage] = useState("");

  const filteredContacts = mockContacts.filter(
    (c) => (activeTab === "Active" ? c.isActive : !c.isActive)
  );

  return (
    <div className="flex h-[calc(100vh-140px)] bg-background rounded-xl overflow-hidden border shadow-sm">
      {/* Left Pane - Contacts List */}
      <div className="w-full md:w-[320px] lg:w-[380px] border-r flex flex-col bg-background/50 flex-shrink-0">
        {/* Header & Search */}
        <div className="p-4 space-y-4 border-b">
          <h2 className="text-xl font-bold">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input className="pl-9 bg-muted/50 border-none" placeholder="Search chats" />
          </div>
          
          {/* Tabs */}
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("Active")}
              className={cn(
                "flex-1 text-sm font-medium py-1.5 rounded-md transition-colors",
                activeTab === "Active" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab("Inactive")}
              className={cn(
                "flex-1 text-sm font-medium py-1.5 rounded-md transition-colors",
                activeTab === "Inactive" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={cn(
                "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0",
                selectedContact.id === contact.id && "bg-muted/80"
              )}
            >
              <div className="relative">
                <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
                {contact.isActive && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-semibold truncate">{contact.name}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">{contact.messages[contact.messages.length - 1]?.timestamp}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {contact.messages[contact.messages.length - 1]?.text}
                </p>
              </div>
              {!contact.messages[contact.messages.length - 1]?.isRead && contact.messages[contact.messages.length - 1]?.senderId !== currentUserId && (
                <div className="w-2 h-2 bg-[#3B66D8] rounded-full shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane - Chat View */}
      <div className="flex-1 flex flex-col bg-muted/10 hidden md:flex relative">
        {/* Chat Header */}
        <div className="h-[72px] flex items-center justify-between px-6 border-b bg-background/50 backdrop-blur z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <img src={selectedContact.avatar} alt={selectedContact.name} className="w-10 h-10 rounded-full object-cover" />
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                {selectedContact.name}
                <span className="text-xs font-medium text-[#3B66D8] bg-[#3B66D8]/10 px-2 py-0.5 rounded-full">Visit 2</span>
              </h2>
              <p className="text-xs text-muted-foreground">Last visit {selectedContact.lastVisit}</p>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-center">
            <span className="text-xs font-medium text-white bg-slate-700 dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm">
              Today, Nov 16
            </span>
          </div>

          {selectedContact.messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={cn("flex flex-col max-w-[85%] lg:max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  {!isMe && <span className="text-xs font-medium text-muted-foreground">{selectedContact.name}</span>}
                  <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                  {isMe && <span className="text-xs font-medium text-muted-foreground">You</span>}
                </div>
                <div className="flex items-end gap-2">
                  {!isMe && <img src={selectedContact.avatar} alt="avatar" className="w-8 h-8 rounded-full mb-1 shrink-0 shadow-sm" />}
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl text-[15px] shadow-sm leading-relaxed",
                      isMe 
                        ? "bg-[#3B66D8] text-white rounded-br-sm" 
                        : "bg-white dark:bg-muted text-foreground rounded-bl-sm border dark:border-none"
                    )}
                  >
                    {msg.text}
                  </div>
                  {isMe && <img src="https://i.pravatar.cc/150?u=current" alt="You" className="w-8 h-8 rounded-full mb-1 shrink-0 bg-muted shadow-sm" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-background border-t">
          <div className="flex items-center gap-2 bg-muted/30 border rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-[#3B66D8]/20 focus-within:border-[#3B66D8] transition-all">
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors shrink-0">
              <Smile size={20} />
            </button>
            <Input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..." 
              className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 px-2"
            />
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <button className="p-2 hover:text-foreground hover:bg-muted rounded-full transition-colors"><Paperclip size={20} /></button>
              <button className="p-2 hover:text-foreground hover:bg-muted rounded-full transition-colors"><ImageIcon size={20} /></button>
            </div>
            <Button size="sm" className="bg-[#3B66D8] hover:bg-[#2b4eb3] text-white gap-2 px-4 rounded-lg h-9 ml-2 shrink-0">
              <Send size={16} className="-ml-1" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
