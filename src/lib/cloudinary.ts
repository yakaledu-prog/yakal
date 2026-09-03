// ============================================================
// Uploading a public image.
//
// The rule this settles: Cloudinary for anything the world may see, Supabase
// Storage for anything private, Drive for documents somebody collaborates on.
//
// Before this, avatars went to a Supabase bucket while the seeded avatar URLs
// pointed at Cloudinary, so the two disagreed about where a profile picture
// lives. A picture is public by nature, Cloudinary does the face-aware crop the
// app already relies on, and every bucket removed is one less thing outside the
// database backup.
//
// A CV deliberately does not come through here. Cloudinary URLs are public, a
// CV carries somebody's address and employment history, and free accounts have
// to actively enable PDF delivery to serve one at all. That is the wrong
// direction for a private document; those stay on Supabase Storage with RLS.
// ============================================================

/** Unsigned preset, so this runs from the browser with no secret. */
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

/**
 * Send an image to Cloudinary and get back a URL to store.
 *
 * `folder` keeps the media library navigable rather than one flat list of
 * everything the platform has ever uploaded.
 *
 * Throws rather than returning an error, because every caller here is inside a
 * try/catch that already knows how to tell the person it did not work.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!cloudinaryConfigured()) {
    throw new Error(
      "Image uploads are not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", PRESET);
  form.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    // Cloudinary explains itself properly, and the reason is usually the
    // preset rather than the file, which is worth seeing.
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloudinary refused the upload. ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.secure_url) throw new Error("Cloudinary returned no URL.");
  return data.secure_url as string;
}

/**
 * A stored Cloudinary URL, cropped square around a detected face.
 *
 * Applied at read time rather than upload, so the original is kept and a
 * different size can be asked for later without re-uploading anything. Left
 * alone if the URL is not Cloudinary's: plenty of avatars are Dicebear or came
 * from the old bucket, and those still have to render.
 */
export function faceCrop(url: string | null | undefined, size = 400): string | null {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com") || url.includes("/c_fill")) return url;
  return url.replace("/upload/", `/upload/c_fill,g_face,w_${size},h_${size},q_auto,f_auto/`);
}
