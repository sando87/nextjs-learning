"use server";

import { revalidatePath } from "next/cache";
import { addCommentToStore } from "@/lib/comments-store";
import { getPostBySlug } from "@/lib/posts";

export async function addComment(formData: FormData) {
  const slug = formData.get("slug");
  const text = formData.get("text");

  if (typeof slug !== "string" || typeof text !== "string") {
    return;
  }

  if (!getPostBySlug(slug)) {
    return;
  }

  await addCommentToStore(slug, text);
  revalidatePath(`/blog/${slug}`);
}
