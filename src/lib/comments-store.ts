import { createClient } from "@/lib/supabase/server";

export type Comment = {
  id: string;
  slug: string;
  text: string;
  createdAt: string;
};

type CommentRow = {
  id: string;
  slug: string;
  text: string;
  created_at: string;
};

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    slug: row.slug,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function getCommentsBySlug(slug: string): Promise<Comment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .select("id, slug, text, created_at")
    .eq("slug", slug)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toComment);
}

export async function addCommentToStore(
  slug: string,
  text: string,
): Promise<Comment> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Comment text is required");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .insert({ slug, text: trimmed })
    .select("id, slug, text, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toComment(data);
}
