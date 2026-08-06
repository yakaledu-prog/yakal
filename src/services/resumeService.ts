import { supabase } from "@/lib/supabase";

// ============================================================
// Applicant CVs.
//
// The resumes bucket is private, so nothing here hands out a durable link. A
// CV carries a home address and a phone number; a public URL would make that
// readable by anyone who came across it, forever. Readers get a signed URL
// that expires instead.
//
// profiles.resume_url holds the storage path, not a URL.
// ============================================================

const BUCKET = "resumes";
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * A short-lived link to an applicant's CV, or null if they never uploaded one.
 *
 * Storage policy allows this for the owner and for admins, so a reviewer gets
 * a URL and anyone else gets null rather than a broken tab.
 */
export async function getResumeUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;

  // Older rows stored a full public URL from before the bucket was private.
  // Nothing can be signed from that, so send it back as-is and let it fail
  // visibly rather than silently returning null.
  if (path.startsWith("http")) return path;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.warn("Could not sign the CV URL", error.message);
    return null;
  }
  return data.signedUrl;
}

/** The original filename, for showing next to a download link. */
export function resumeFileName(path: string | null | undefined): string {
  if (!path) return "Resume";
  return path.split("/").pop() || "Resume";
}

/**
 * Replace the signed-in tutor's CV.
 *
 * Same bucket and same path shape as onboarding, so the two paths cannot drift
 * apart. Storage keeps every upload under the owner's folder, which is what
 * the bucket policy is written against.
 */
export async function uploadResume(
  userId: string,
  file: File
): Promise<{ success: boolean; path?: string; error?: string }> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/cv_${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { success: false, error: upErr.message };

  // The path, not a URL: the bucket is private, so readers ask for a
  // short-lived signed link instead.
  const { error } = await supabase.from("profiles").update({ resume_url: path }).eq("id", userId);
  if (error) return { success: false, error: error.message };

  return { success: true, path };
}
