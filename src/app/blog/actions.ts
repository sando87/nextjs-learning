"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addCommentToStore, toAuthorName } from "@/lib/comments-store";
import { getPostBySlug } from "@/lib/posts";
import { createClient } from "@/lib/supabase/server";

export async function addComment(formData: FormData) {
  const slug = formData.get("slug");
  const text = formData.get("text");

  if (typeof slug !== "string" || typeof text !== "string") {
    return;
  }

  if (!getPostBySlug(slug)) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await addCommentToStore(
    slug,
    text,
    user.id,
    toAuthorName(user.email, user.id),
  );
  revalidatePath(`/blog/${slug}`);
}
