import { createClient } from "@/lib/supabase/server";

export type Comment = {
  id: string;
  slug: string;
  text: string;
  createdAt: string;
  userId: string | null;
  authorName: string | null;
};

type CommentRow = {
  id: string;
  slug: string;
  text: string;
  created_at: string;
  user_id: string | null;
  author_name: string | null;
};

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    slug: row.slug,
    text: row.text,
    createdAt: row.created_at,
    userId: row.user_id,
    authorName: row.author_name,
  };
}

// 이메일이면 @ 앞부분만, 아니면 UUID 앞 8자
export function toAuthorName(
  email: string | undefined,
  userId: string,
): string {
  if (email?.includes("@")) {
    return email.split("@")[0];
  }

  return userId.slice(0, 8);
}

export async function getCommentsBySlug(slug: string): Promise<Comment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .select("id, slug, text, created_at, user_id, author_name")
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
  userId: string,
  authorName: string,
): Promise<Comment> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Comment text is required");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .insert({
      slug,
      text: trimmed,
      user_id: userId,
      author_name: authorName,
    })
    .select("id, slug, text, created_at, user_id, author_name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toComment(data);
}
