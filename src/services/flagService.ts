import { supabase } from "@/lib/supabase";

// ============================================================
// Reporting a conversation.
//
// A report names the message it is about, picked in the dialog rather than
// from a flag icon on every bubble: dozens of controls on screen for something
// done once in a hundred sessions is a bad trade, but an admin still needs to
// know which message caused the complaint.
//
// message_id stays optional. A concern about a pattern, such as repeated
// cancellations, is not about any one message, and making people pick one
// would only produce arbitrary answers.
// ============================================================

export type FlagReason =
  | "inappropriate"
  | "off_platform"
  | "no_show"
  | "quality"
  | "other";

export const FLAG_REASONS: { value: FlagReason; label: string; hint: string }[] = [
  {
    value: "inappropriate",
    label: "Inappropriate content",
    hint: "Language or material that should not be here.",
  },
  {
    value: "off_platform",
    label: "Moving off the platform",
    hint: "Asking to arrange or pay for sessions elsewhere.",
  },
  {
    value: "no_show",
    label: "Missed sessions",
    hint: "Sessions not attended, or repeatedly cancelled.",
  },
  {
    value: "quality",
    label: "Quality of teaching",
    hint: "Concerns about how the sessions are going.",
  },
  { value: "other", label: "Something else", hint: "Tell us in your own words." },
];

export interface ConversationFlag {
  id: string;
  conversation_id: string;
  reported_by: string;
  reason: FlagReason;
  note: string | null;
  message_id: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
}

/** The signed-in user's own open reports on a conversation. */
export async function getMyFlags(
  conversationId: string,
  userId: string
): Promise<ConversationFlag[]> {
  const { data } = await supabase
    .from("conversation_flags")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("reported_by", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return (data as ConversationFlag[]) ?? [];
}

export async function flagConversation(input: {
  conversationId: string;
  userId: string;
  reason: FlagReason;
  note?: string | null;
  /** The message being reported. Null for a concern about the thread overall. */
  messageId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("conversation_flags").insert({
    conversation_id: input.conversationId,
    reported_by: input.userId,
    reason: input.reason,
    note: input.note?.trim() || null,
    message_id: input.messageId ?? null,
  });

  if (error) {
    // The partial unique index is what stops a second open report. Say so
    // plainly rather than surfacing a constraint name.
    if (error.code === "23505") {
      return {
        success: false,
        error: input.messageId
          ? "You have already reported that message."
          : "You have already reported this conversation.",
      };
    }
    console.error("flagConversation failed:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Withdraw a report the reporter changed their mind about. */
export async function withdrawFlag(flagId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("conversation_flags").delete().eq("id", flagId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
