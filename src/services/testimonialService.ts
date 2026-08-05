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

export async function createTestimonial(input: TestimonialInput): Promise<Result<string>> {
  const { data, error } = await supabase
    .from("testimonials")
    .insert(input)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data.id };
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
