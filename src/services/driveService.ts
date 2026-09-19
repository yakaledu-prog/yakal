import { authedPost } from "@/lib/authedFetch";

/**
 * Client for the server-side Drive endpoint.
 *
 * There is deliberately no Google sign-in here. Documents live in Yakal's
 * Shared Drive and are written by a service account, so a student never
 * authenticates to Google and a counselor never has to be granted access to
 * anything by hand. See api/drive.ts for why the browser picker was dropped.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
  /** Custom metadata we set, kept on the file so it needs no second source. */
  appProperties?: {
    slot?: string;
    review?: ReviewVerdict;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNote?: string;
  };
}

export interface DriveSection {
  name: string;
  files: DriveFile[];
}

export interface DriveListing {
  folderId: string;
  folderUrl: string;
  loose: DriveFile[];
  sections: DriveSection[];
}

export type DocumentSection = "Transcripts" | "Essays" | "Test scores" | "Other";

/**
 * Vercel caps a function request body at 4.5 MB, and base64 inflates a file by
 * four thirds, so the real ceiling is about 3.3 MB before the request is
 * rejected with a 413 that never reaches our error handling. 3 MB leaves room
 * for the surrounding JSON.
 *
 * Not a real constraint for this feature: transcripts and score reports are
 * typically well under a megabyte. Anything larger needs a direct-to-Drive
 * upload rather than a bigger number here.
 */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/**
 * Signed in, and throwing on failure.
 *
 * This was a plain fetch with no token, to an endpoint that asked nobody who
 * they were. authedPost carries the session and refreshes it; it returns
 * { error } rather than throwing, so this throws, because react-query's error
 * states and isConfigured() below both expect a thrown Error.
 */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const out = await authedPost<T>("/api/google?action=drive", body);
  if (out.error) throw new Error(out.error);
  return out as T;
}

/**
 * The name and email are no longer read by the server, which looks both up
 * from the student's profile; they stay in the signature so callers compile.
 * Sending them is what let a counsellor's own email be shared as writer on a
 * student's folder, because the tracker passed the signed-in user's.
 */
export function listDocuments(
  studentId: string,
  studentName: string,
  studentEmail?: string | null
) {
  return call<DriveListing>({ action: "list", studentId, studentName, studentEmail });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // readAsDataURL gives "data:<mime>;base64,<payload>"; the API wants the tail.
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadDocument(
  studentId: string,
  studentName: string,
  section: DocumentSection,
  file: File,
  studentEmail?: string | null,
  slot?: string
) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB.`
    );
  }
  const dataBase64 = await toBase64(file);
  return call<{ file: DriveFile }>({
    action: "upload",
    studentId,
    studentName,
    studentEmail,
    section,
    slot,
    filename: file.name,
    mimeType: file.type,
    dataBase64,
  });
}

/** Create an essay as a Doc both the student and their counselor can open. */
export function createEssayDoc(args: {
  studentId: string;
  studentName: string;
  title: string;
  studentEmail?: string | null;
  counselorEmail?: string | null;
}) {
  return call<{ file: DriveFile }>({ action: "createDoc", ...args });
}

export type ReviewVerdict = "pending" | "verified" | "needs_attention";

/**
 * Record a counselor's verdict on a file.
 *
 * A file with no verdict is treated as pending rather than approved: silence
 * must never read as a pass.
 */
export function reviewDocument(args: {
  /** Whose document. The server checks the file is in their folder. */
  studentId: string;
  fileId: string;
  verdict: ReviewVerdict;
  note?: string | null;
}) {
  return call<{ file: DriveFile }>({ action: "review", ...args });
}

/**
 * Live word counts for essay Docs, keyed by Drive file id.
 *
 * Batched deliberately: one request for a whole page of essays rather than one
 * per row, since each count is a full text export on the server.
 */
export async function wordCounts(studentId: string, fileIds: string[]) {
  if (fileIds.length === 0) return new Map<string, number>();
  const { counts } = await call<{ counts: { fileId: string; words: number | null }[] }>({
    action: "wordCount",
    studentId,
    fileIds,
  });
  return new Map(
    counts.filter((c) => c.words !== null).map((c) => [c.fileId, c.words as number])
  );
}

/** Drive URLs carry the file id between /d/ and the next slash. */
export function fileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

export function deleteDocument(studentId: string, fileId: string) {
  return call<{ ok: true }>({ action: "delete", studentId, fileId });
}

export function isConfigured(err: unknown): boolean {
  // The endpoint names the missing variables rather than failing silently, so
  // the UI can tell "not set up yet" apart from "something broke".
  const m = err instanceof Error ? err.message : String(err);
  return !/GOOGLE_OAUTH_REFRESH_TOKEN|GOOGLE_SERVICE_ACCOUNT_JSON|GOOGLE_SHARED_DRIVE_ID/.test(m);
}

// --- one essay, opened ------------------------------------------------------

export interface EssayDoc {
  file: {
    id: string;
    name: string;
    modifiedTime?: string;
    webViewLink?: string;
    capabilities?: { canComment?: boolean; canEdit?: boolean };
  };
  /** The Doc's body, exported and stripped. See api/_handlers/drive.ts. */
  html: string;
  words: number;
  /** When this snapshot was taken. Editing happens in the Doc, so the page has
   *  to be honest that what it shows can be a minute old. */
  fetchedAt: string;
}

export interface CommentReply {
  id: string;
  createdTime: string;
  author: string;
  authorPhoto: string | null;
  content: string;
  action: string | null;
}

export interface CommentThread {
  id: string;
  createdTime: string;
  modifiedTime: string;
  resolved: boolean;
  /** The passage the comment hangs off, when Docs recorded one. */
  quoted: string | null;
  author: string;
  authorPhoto: string | null;
  content: string;
  replies: CommentReply[];
}

// By essay rather than by file: the server finds the Doc from the essay row
// and checks it is in that student's folder, so a file id alone opens nothing.
export function getEssayDoc(essayId: string) {
  return call<EssayDoc>({ action: "doc", essayId });
}

export async function getComments(essayId: string) {
  const { threads } = await call<{ threads: CommentThread[] }>({ action: "comments", essayId });
  return threads;
}

/**
 * The author is named in the text, because every write reaches Google as the
 * single Yakal account that holds the credential. The server takes the name
 * from the signed-in person's profile now, not from here, so a comment cannot
 * be signed as somebody else.
 */
export function addComment(essayId: string, content: string) {
  return call<{ id: string }>({ action: "comment", essayId, content });
}

export function replyToComment(args: {
  essayId: string;
  commentId: string;
  content?: string;
  resolve?: boolean;
  reopen?: boolean;
}) {
  return call<{ id: string }>({ action: "reply", ...args });
}
