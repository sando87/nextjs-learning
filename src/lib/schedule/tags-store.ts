import { createClient } from "@/lib/supabase/server";
import type { Tag } from "./types";

type TagRow = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color,
  };
}

export async function getTagsByProject(projectId: string): Promise<Tag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, project_id, name, color")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toTag);
}

export async function createTag(
  projectId: string,
  name: string,
  color: string,
): Promise<Tag> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("태그 이름을 입력하세요");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .insert({ project_id: projectId, name: trimmed, color })
    .select("id, project_id, name, color")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 태그입니다");
    }
    throw new Error(error.message);
  }

  return toTag(data);
}

export async function deleteTag(tagId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setTaskTags(
  taskId: string,
  tagIds: string[],
): Promise<void> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (tagIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("task_tags").insert(
    tagIds.map((tagId) => ({ task_id: taskId, tag_id: tagId })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}
