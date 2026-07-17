import { createClient } from "@/lib/supabase/server";

export async function addTaskLink(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<void> {
  if (sourceTaskId === targetTaskId) {
    throw new Error("같은 업무는 연결할 수 없습니다");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("task_links").insert({
    source_task_id: sourceTaskId,
    target_task_id: targetTaskId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 연결된 업무입니다");
    }
    throw new Error(error.message);
  }
}

export async function removeTaskLink(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_links")
    .delete()
    .eq("source_task_id", sourceTaskId)
    .eq("target_task_id", targetTaskId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getLinkedTasks(sourceTaskId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_links")
    .select("target_task_id")
    .eq("source_task_id", sourceTaskId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.target_task_id);
}
