import { createClient } from "@/lib/supabase/server";
import { getProfilesByIds } from "@/lib/schedule/profiles-store";
import type { Tag, Task, TaskStatus } from "./types";

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  assignee_id: string | null;
  status: TaskStatus;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  sort_order: number;
};

type TagRow = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

type LinkRow = {
  source_task_id: string;
  target_task_id: string;
};

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color,
  };
}

function toTask(
  row: TaskRow,
  assignee: Task["assignee"],
  tags: Tag[] = [],
  linkedTaskIds: string[] = [],
): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    assigneeId: row.assignee_id,
    assignee,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    priority: row.priority,
    sortOrder: row.sort_order,
    tags,
    linkedTaskIds,
  };
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const supabase = await createClient();

  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, project_id, title, assignee_id, status, start_date, end_date, priority, sort_order",
    )
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("priority", { ascending: true });

  if (taskError) {
    throw new Error(taskError.message);
  }

  const taskRows = (tasks ?? []) as TaskRow[];
  const taskIds = taskRows.map((t) => t.id);

  if (taskIds.length === 0) {
    return [];
  }

  const assigneeIds = [
    ...new Set(
      taskRows
        .map((t) => t.assignee_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const profiles = await getProfilesByIds(assigneeIds);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const { data: taskTags, error: tagError } = await supabase
    .from("task_tags")
    .select("task_id, tag_id")
    .in("task_id", taskIds);

  if (tagError) {
    throw new Error(tagError.message);
  }

  const tagIds = [...new Set((taskTags ?? []).map((row) => row.tag_id))];
  const { data: tagRows, error: tagsError } = tagIds.length
    ? await supabase
        .from("tags")
        .select("id, project_id, name, color")
        .in("id", tagIds)
    : { data: [], error: null };

  if (tagsError) {
    throw new Error(tagsError.message);
  }

  const tagMap = new Map((tagRows ?? []).map((t) => [t.id, toTag(t as TagRow)]));

  const tagsByTask = new Map<string, Tag[]>();
  for (const row of taskTags ?? []) {
    const tag = tagMap.get(row.tag_id);
    if (!tag) continue;
    const list = tagsByTask.get(row.task_id) ?? [];
    list.push(tag);
    tagsByTask.set(row.task_id, list);
  }

  const { data: links, error: linkError } = await supabase
    .from("task_links")
    .select("source_task_id, target_task_id")
    .in("source_task_id", taskIds);

  if (linkError) {
    throw new Error(linkError.message);
  }

  const linksByTask = new Map<string, string[]>();
  for (const row of (links ?? []) as LinkRow[]) {
    const list = linksByTask.get(row.source_task_id) ?? [];
    list.push(row.target_task_id);
    linksByTask.set(row.source_task_id, list);
  }

  return taskRows.map((row) =>
    toTask(
      row,
      row.assignee_id ? profileMap.get(row.assignee_id) ?? null : null,
      tagsByTask.get(row.id) ?? [],
      linksByTask.get(row.id) ?? [],
    ),
  );
}

export type CreateTaskInput = {
  projectId: string;
  title: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  startDate?: string | null;
  endDate?: string | null;
  priority?: number;
};

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const trimmed = input.title.trim();
  if (!trimmed) {
    throw new Error("업무 이름을 입력하세요");
  }

  const supabase = await createClient();

  const { data: maxOrder } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("project_id", input.projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxOrder?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: input.projectId,
      title: trimmed,
      assignee_id: input.assigneeId ?? null,
      status: input.status ?? "planned",
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      priority: input.priority ?? 100,
      sort_order: sortOrder,
    })
    .select(
      "id, project_id, title, assignee_id, status, start_date, end_date, priority, sort_order",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as TaskRow;
  let assignee = null;
  if (row.assignee_id) {
    const profiles = await getProfilesByIds([row.assignee_id]);
    assignee = profiles[0] ?? null;
  }

  return toTask(row, assignee);
}

export type UpdateTaskInput = {
  title?: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  startDate?: string | null;
  endDate?: string | null;
  priority?: number;
};

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> {
  const supabase = await createClient();
  const payload: {
    title?: string;
    assignee_id?: string | null;
    status?: TaskStatus;
    start_date?: string | null;
    end_date?: string | null;
    priority?: number;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (!trimmed) {
      throw new Error("업무 이름을 입력하세요");
    }
    payload.title = trimmed;
  }
  if (input.assigneeId !== undefined) payload.assignee_id = input.assigneeId;
  if (input.status !== undefined) payload.status = input.status;
  if (input.startDate !== undefined) payload.start_date = input.startDate;
  if (input.endDate !== undefined) payload.end_date = input.endDate;
  if (input.priority !== undefined) payload.priority = input.priority;

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select(
      "id, project_id, title, assignee_id, status, start_date, end_date, priority, sort_order",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as TaskRow;
  let assignee = null;
  if (row.assignee_id) {
    const profiles = await getProfilesByIds([row.assignee_id]);
    assignee = profiles[0] ?? null;
  }

  return toTask(row, assignee);
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, project_id, title, assignee_id, status, start_date, end_date, priority, sort_order",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as TaskRow;
  let assignee = null;
  if (row.assignee_id) {
    const profiles = await getProfilesByIds([row.assignee_id]);
    assignee = profiles[0] ?? null;
  }

  return toTask(row, assignee);
}
