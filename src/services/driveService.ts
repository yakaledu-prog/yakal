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

/** Anything above this is almost certainly not a transcript or a score report. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/drive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Drive request failed (${res.status})`);
  return json as T;
}

export function listDocuments(studentId: string, studentName: string) {
  return call<DriveListing>({ action: "list", studentId, studentName });
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
  file: File
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
    section,
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

export function deleteDocument(fileId: string) {
  return call<{ ok: true }>({ action: "delete", fileId });
}

export function isConfigured(err: unknown): boolean {
  // The endpoint reports missing configuration rather than failing silently, so
  // the UI can tell "not set up yet" apart from "something broke".
  const m = err instanceof Error ? err.message : String(err);
  return !/GOOGLE_SERVICE_ACCOUNT_JSON|GOOGLE_SHARED_DRIVE_ID/.test(m);
}
