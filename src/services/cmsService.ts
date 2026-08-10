import { supabase } from "@/lib/supabase";

export interface BlogPost {
  id: string;
  title: string;
  content: string; // HTML
  thumbnail_url: string | null;
  read_time_minutes: number;
  status: "draft" | "published";
  /** When the newsletter for this post went out. Null means never. */
  newsletter_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogPostInput = Omit<
  BlogPost,
  "id" | "created_at" | "updated_at" | "read_time_minutes" | "newsletter_sent_at"
>;

type Result<T = undefined> = { success: boolean; data?: T; error?: string };

// Utility to roughly extract text from HTML and calculate read time (assume 200 wpm)
export function calculateReadTime(html: string): number {
  const text = html.replace(/<[^>]*>?/gm, " ");
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const minutes = Math.ceil(wordCount / 200);
  return Math.max(1, minutes);
}

export async function getPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
  return data as BlogPost[];
}

export async function getPost(id: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching post:", error);
    return null;
  }
  return data as BlogPost;
}

export async function createPost(input: BlogPostInput): Promise<Result<string>> {
  const read_time_minutes = calculateReadTime(input.content);
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({ ...input, read_time_minutes })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data.id };
}

export async function updatePost(id: string, input: Partial<BlogPostInput>): Promise<Result> {
  const updateData: any = { ...input, updated_at: new Date().toISOString() };
  if (input.content) {
    updateData.read_time_minutes = calculateReadTime(input.content);
  }

  const { error } = await supabase
    .from("blog_posts")
    .update(updateData)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deletePost(id: string): Promise<Result> {
  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
