import { getBaseUrl } from "@/lib/get-base-url";
import type { Post } from "@/lib/posts";

// Server Component에서 /api/posts를 fetch하는 헬퍼
export async function fetchPosts(): Promise<Post[]> {
  const res = await fetch(`${await getBaseUrl()}/api/posts`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch posts");
  }

  return res.json();
}

export async function fetchPostBySlug(slug: string): Promise<Post | null> {
  const res = await fetch(`${await getBaseUrl()}/api/posts/${slug}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error("Failed to fetch post");
  }

  return res.json();
}
