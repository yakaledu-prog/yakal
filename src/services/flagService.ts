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
  /** Every reason chosen. `reason` holds the first, for older rows. */
  reasons: FlagReason[] | null;
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
  /** All reasons chosen. These are not exclusive in practice. */
  reasons: FlagReason[];
  note?: string | null;
  /**
   * The messages being reported. Empty means a concern about the thread
   * overall. Several at once because a problem is often a short exchange
   * rather than one line, and filing them separately would split one
   * complaint across several rows in the admin queue.
   */
  messageIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  const ids = input.messageIds?.length ? input.messageIds : [null];
  const { error } = await supabase.from("conversation_flags").insert(
    ids.map((message_id) => ({
      conversation_id: input.conversationId,
      reported_by: input.userId,
      // `reason` carries the first choice so the column stays populated for
      // anything reading it directly.
      reason: input.reasons[0],
      reasons: input.reasons,
      note: input.note?.trim() || null,
      message_id,
    }))
  );

  if (error) {
    // The partial unique index is what stops a second open report. Say so
    // plainly rather than surfacing a constraint name.
    if (error.code === "23505") {
      return {
        success: false,
        error: input.messageIds?.length
          ? "You have already reported one of those messages."
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

// ------------------------------------------------------------
// The admin side.
//
// A report is only worth filing if somebody acts on it, so the queue has to
// answer three things at a glance: who complained, about whom, and what was
// actually said. That means joining the message and both people, not just
// listing report rows.
//
// Reads go through the admin policy on conversation_flags, so a non-admin
// calling these gets an empty list rather than an error.
// ------------------------------------------------------------

export type FlagStatus = "open" | "reviewed" | "dismissed";

export interface AdminFlag {
  id: string;
  conversationId: string;
  reasons: FlagReason[];
  note: string | null;
  status: FlagStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reporter: { id: string; name: string; role: string; avatarUrl: string | null };
  /** The message complained about. Null for a concern about the thread. */
  message: { id: string; text: string; createdAt: Date } | null;
  /** Who wrote the reported message, or the other party in the conversation. */
  subject: { id: string; name: string; role: string; avatarUrl: string | null } | null;
}

export async function getFlags(status: FlagStatus | "all" = "open"): Promise<AdminFlag[]> {
  let query = supabase
    .from("conversation_flags")
    .select(
      `id, conversation_id, reason, reasons, note, status, created_at, reviewed_at, message_id,
       reporter:profiles!conversation_flags_reported_by_fkey (id, full_name, role, avatar_url),
       message:messages!conversation_flags_message_id_fkey (
         id, content, created_at,
         sender:profiles!messages_sender_profile_fkey (id, full_name, role, avatar_url)
       )`
    )
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("getFlags failed:", error);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const sender = row.message?.sender ?? null;
    return ({
    id: row.id,
    conversationId: row.conversation_id,
    reasons: (row.reasons?.length ? row.reasons : [row.reason]) as FlagReason[],
    note: row.note,
    status: row.status,
    createdAt: new Date(row.created_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    reporter: {
      id: row.reporter?.id ?? "",
      name: row.reporter?.full_name ?? "Someone",
      role: row.reporter?.role ?? "",
      avatarUrl: row.reporter?.avatar_url ?? null,
    },
    message: row.message
      ? {
          id: row.message.id,
          text: row.message.content ?? "",
          createdAt: new Date(row.message.created_at),
        }
      : null,
    subject: sender
      ? {
          id: sender.id,
          name: sender.full_name ?? "Someone",
          role: sender.role ?? "",
          avatarUrl: sender.avatar_url ?? null,
        }
      : null,
  });
  });
}

/**
 * Close a report.
 *
 * "reviewed" means acted on, "dismissed" means looked at and found to be
 * nothing. Both are decisions, and both are recorded with who made them:
 * deleting the row instead would lose the fact that anybody looked.
 */
export async function setFlagStatus(
  flagId: string,
  status: Exclude<FlagStatus, "open">,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("conversation_flags")
    .update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Reopen something closed by mistake. */
export async function reopenFlag(flagId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("conversation_flags")
    .update({ status: "open", reviewed_by: null, reviewed_at: null })
    .eq("id", flagId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
