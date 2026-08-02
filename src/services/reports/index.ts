// Reports, from both directions.
//
//   flagService     what a person files: the reasons, the queue, the decision
//   messageReports  what the scan trigger files on its own, before anybody has
//                   noticed there was something to report
//
// The two meet in the parent's messages view, where a scanned message shows up
// marked and the report dialog opens with it already picked.

export {
  FLAG_REASONS,
  flagConversation,
  getFlags,
  getMyFlags,
  getReportedConversation,
  reopenFlag,
  setFlagStatus,
  withdrawFlag,
  type AdminFlag,
  type ConversationFlag,
  type FlagReason,
  type FlagStatus,
  type ReportedMessage,
} from "./flagService";

export {
  REPORT_CATEGORIES,
  describeReport,
  getConversationReports,
  getFlaggedConversationIds,
  getFlaggedStudentIds,
  getReportedMessageIds,
  getSenderReportSummaries,
  reasonsFor,
  type MessageReport,
  type ReportCategory,
  type ReportSeverity,
  type SenderReportSummary,
} from "./messageReports";
