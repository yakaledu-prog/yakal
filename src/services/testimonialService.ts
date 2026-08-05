import { supabase } from "@/lib/supabase";

/**
 * Testimonials on the marketing page.
 *
 * Same shape as cmsService: an admin edits, the public reads. RLS decides who
 * sees drafts, so getPublishedTestimonials and getAllTestimonials run the same
 * query and differ only in what the database is willing to return.
 */
export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatar_url: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TestimonialInput = Omit<Testimonial, "id" | "created_at" | "updated_at">;

type Result<T = void> = { success: boolean; error?: string; data?: T };

/** Published only. Safe to call signed out; the landing page does. */
export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    // The page keeps its built-in copy rather than rendering an empty band,
    // so a database that is down costs nothing a visitor can see.
    console.error("getPublishedTestimonials:", error.message);
    return [];
  }
  return data ?? [];
}

/** Everything, drafts included. Returns published only unless you are an admin. */
export async function getAllTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getAllTestimonials:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Starting points for the role field, not a closed list.
 *
 * The useful label is specific: "Algebra Student" says more than "Student",
 * and that specificity is most of what a testimonial is doing on a tutoring
 * site. So the field takes any text. Offering what has been used before is
 * what stops the same idea being spelled three ways, which is the actual risk
 * with free text, rather than the freedom itself.
 */
const ROLE_SEEDS = ["Student", "Parent", "Tutor", "Counselor"];

/** profiles.role is lowercase. Prefilled capitalised, then edited if wanted. */
export function roleLabel(profileRole: string | null | undefined): string {
  if (!profileRole) return "";
  return profileRole.charAt(0).toUpperCase() + profileRole.slice(1).toLowerCase();
}

/** Roles already in use, plus the seeds, for the role field's suggestions. */
export function roleSuggestions(existing: Testimonial[]): string[] {
  const used = existing.map((t) => t.role.trim()).filter(Boolean);
  return [...new Set([...used, ...ROLE_SEEDS])].sort((a, b) => a.localeCompare(b));
}

/**
 * New testimonials go to the top.
 *
 * Ordering is lowest-first, so "top" means below the current minimum rather
 * than zero. Somebody adding one has just decided it is worth showing, and
 * burying it under everything written before is the opposite of that.
 */
export async function createTestimonial(
  input: Omit<TestimonialInput, "sort_order">
): Promise<Result<string>> {
  const { data: first } = await supabase
    .from("testimonials")
    .select("sort_order")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const sort_order = (first?.sort_order ?? 10) - 10;

  const { data, error } = await supabase
    .from("testimonials")
    .insert({ ...input, sort_order })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data.id };
}

/**
 * Write a new order, given the ids in the order they should appear.
 *
 * Renumbered from scratch in tens rather than swapping the two rows that
 * moved. Gaps accumulate otherwise, and after enough drags two rows end up
 * sharing a number, at which point the list orders itself by created_at and
 * appears to ignore the drag entirely.
 */
export async function reorderTestimonials(orderedIds: string[]): Promise<Result> {
  const updates = orderedIds.map((id, i) =>
    supabase.from("testimonials").update({ sort_order: (i + 1) * 10 }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  return failed?.error ? { success: false, error: failed.error.message } : { success: true };
}

/** Upload a photo and return its public URL. Admin only, by bucket policy. */
export async function uploadTestimonialPhoto(file: File): Promise<Result<string>> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("testimonials")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) return { success: false, error: error.message };

  const { data } = supabase.storage.from("testimonials").getPublicUrl(path);
  return { success: true, data: data.publicUrl };
}

export async function updateTestimonial(
  id: string,
  input: Partial<TestimonialInput>
): Promise<Result> {
  const { error } = await supabase.from("testimonials").update(input).eq("id", id);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteTestimonial(id: string): Promise<Result> {
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  return error ? { success: false, error: error.message } : { success: true };
}
