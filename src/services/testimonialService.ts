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
 * The roles a testimonial can carry: the app's own roles, capitalised.
 *
 * Closed rather than free text, because these are filtered, counted and
 * coloured. Free text gave "Algebra Student", "Physics & Calculus Student"
 * and "SAT Prep Student" for three rows, which is a filter with one item
 * behind every option, and no way to colour a card by who is speaking.
 */
export const TESTIMONIAL_ROLES = ["Student", "Parent", "Tutor", "Counselor"] as const;
export type TestimonialRole = (typeof TESTIMONIAL_ROLES)[number];

/** profiles.role is lowercase. Returns "" for anything not in the set. */
export function roleLabel(profileRole: string | null | undefined): TestimonialRole | "" {
  if (!profileRole) return "";
  return TESTIMONIAL_ROLES.find((r) => r.toLowerCase() === profileRole.toLowerCase()) ?? "";
}

/**
 * The outline a card gets for each role.
 *
 * Three brand colours against four roles, so Parent keeps the neutral border.
 * Tutor and Counselor follow the mapping the billing cards already use, so a
 * gold outline means the same thing in both places.
 */
export const ROLE_COLOR: Record<string, string> = {
  Student: "#97CE9D",
  Tutor: "#CAA25F",
  Counselor: "#1099A1",
};

/**
 * The same colour, faint, for a count badge to sit on.
 *
 * Built from the brand hex rather than reaching for a theme token, because
 * --muted-foreground is #717182, which is a blue-violet grey. Fine as body
 * text, wrong as a swatch beside three brand colours: it reads as a fourth
 * colour that nobody chose.
 */
export function roleTint(role: string, alpha = 0.16): string | undefined {
  const hex = ROLE_COLOR[role];
  if (!hex) return undefined;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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
