import { supabase } from "@/lib/supabase";

import type { FlagReason } from "./flagService";

// ============================================================
// What the database noticed on its own.
//
// A report only works if somebody is reading, and the person best placed to
// read a grooming attempt is the child being groomed. So every message is
// scanned as it is written, by a trigger rather than by this file: the app is
// not the only way into that table, and a check that lives in the client can
// be skipped by not using the client.
//
// Nothing here writes. Reading is all the client is allowed to do, and row
// level security means a tutor asking for these rows gets an empty list rather
// than a hint about which word tripped the scan.
// ============================================================

export type ReportCategory =
  | "secrecy"
  | "grooming"
  | "contact_details"
  | "off_platform"
  | "payment";

export type ReportSeverity = "high" | "medium";

/**
 * Each category in the words a parent would use, and the reason a report about
 * it should start on. The mapping matters: a parent who opens the dialog from
 * a flagged message should not have to work out which of five reasons the
 * system meant.
 */
export const REPORT_CATEGORIES: Record<
  ReportCategory,
  { label: string; hint: string; severity: ReportSeverity; reason: FlagReason }
> = {
  secrecy: {
    label: "Asking to keep it secret",
    hint: "Suggesting this conversation is kept from you.",
    severity: "high",
    reason: "inappropriate",
  },
  grooming: {
    label: "Personal or private",
    hint: "Meeting alone, photographs, or questions about your child's private life.",
    severity: "high",
    reason: "inappropriate",
  },
  contact_details: {
    label: "Contact details",
    hint: "A phone number or email address was shared.",
    severity: "medium",
    reason: "off_platform",
  },
  off_platform: {
    label: "Another app",
    hint: "Suggesting you continue somewhere Yakal cannot see.",
    severity: "medium",
    reason: "off_platform",
  },
  payment: {
    label: "Paying outside Yakal",
    hint: "Arranging payment that would not go through the platform.",
    severity: "medium",
    reason: "off_platform",
  },
};

export interface MessageReport {
  messageId: string;
  categories: ReportCategory[];
  /** The worst of them, which is what decides how loudly it is shown. */
  severity: ReportSeverity;
}

/**
 * Everything the scan picked up in one conversation, keyed by message.
 *
 * Empty for anyone who is not an admin or a linked parent, which is the point:
 * a tutor who could see that a message was flagged could work out which word
 * did it and write the next one differently.
 */
export async function getConversationReports(
  conversationId: string
): Promise<Map<string, MessageReport>> {
  const { data, error } = await supabase
    .from("message_reports")
    .select("message_id, category, severity")
    .eq("conversation_id", conversationId);

  const byMessage = new Map<string, MessageReport>();
  if (error) {
    console.error("getConversationReports failed:", error);
    return byMessage;
  }

  for (const row of data ?? []) {
    const existing = byMessage.get(row.message_id);
    if (existing) {
      existing.categories.push(row.category as ReportCategory);
      if (row.severity === "high") existing.severity = "high";
    } else {
      byMessage.set(row.message_id, {
        messageId: row.message_id,
        categories: [row.category as ReportCategory],
        severity: row.severity as ReportSeverity,
      });
    }
  }
  return byMessage;
}

/** The reasons a report should open with, given the messages being reported. */
export function reasonsFor(
  messageIds: string[],
  reports: Map<string, MessageReport>
): FlagReason[] {
  const reasons = new Set<FlagReason>();
  for (const id of messageIds) {
    for (const category of reports.get(id)?.categories ?? []) {
      reasons.add(REPORT_CATEGORIES[category].reason);
    }
  }
  return [...reasons];
}

/** One line explaining why a message was picked out, for the parent to read. */
export function describeReport(report: MessageReport): string {
  return report.categories.map((c) => REPORT_CATEGORIES[c].label).join(", ");
}

// ------------------------------------------------------------
// The admin side
//
// One flagged message is a bad day. The same person across several
// conversations is the pattern worth acting on, which is why this is counted
// per sender rather than listed per message.
// ------------------------------------------------------------

export interface SenderReportSummary {
  senderId: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  highCount: number;
  mediumCount: number;
  conversationCount: number;
  lastReportedAt: Date;
  categories: ReportCategory[];
}

export async function getSenderReportSummaries(): Promise<SenderReportSummary[]> {
  const { data, error } = await supabase
    .from("v_sender_report_summary")
    .select("*")
    .order("high_count", { ascending: false })
    .order("last_reported_at", { ascending: false });

  if (error) {
    console.error("getSenderReportSummaries failed:", error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // The view counts, it does not name. A join inside it would have to be
  // security_invoker all the way down through profiles, and this is one query.
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .in("id", rows.map((r: any) => r.sender_id));

  const byId = new Map((people ?? []).map((p: any) => [p.id, p]));

  return rows.map((r: any) => {
    const person = byId.get(r.sender_id);
    return {
      senderId: r.sender_id,
      name: person?.full_name ?? "Someone",
      role: person?.role ?? "",
      avatarUrl: person?.avatar_url ?? null,
      highCount: Number(r.high_count ?? 0),
      mediumCount: Number(r.medium_count ?? 0),
      conversationCount: Number(r.conversation_count ?? 0),
      lastReportedAt: new Date(r.last_reported_at),
      categories: (r.categories ?? []) as ReportCategory[],
    };
  });
}

/** Which of these messages the scan picked out, for the admin's queue. */
export async function getReportedMessageIds(messageIds: string[]): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();
  const { data } = await supabase
    .from("message_reports")
    .select("message_id")
    .in("message_id", messageIds);
  return new Set((data ?? []).map((r: any) => r.message_id));
}
