import { createClient } from "@/lib/supabase/server";
import { getProfilesByIds } from "@/lib/schedule/profiles-store";
import { getWorkLogsByTaskIds } from "@/lib/schedule/work-logs-store";
import { computeSortOrderUpdates } from "@/lib/schedule/task-sort-order";
import { isDescendantOf } from "@/lib/schedule/task-tree";
import type { Tag, Task, TaskStatus, WorkLog } from "./types";

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
  parent_id: string | null;
  created_at: string;
};

type TagRow = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

const TASK_SELECT =
  "id, project_id, title, assignee_id, status, start_date, end_date, priority, sort_order, parent_id, created_at";

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
  workLogs: WorkLog[] = [],
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
    parentId: row.parent_id,
    createdAt: row.created_at,
    tags,
    workLogs,
  };
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const supabase = await createClient();

  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
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

  const workLogsByTask = await getWorkLogsByTaskIds(taskIds);

  return taskRows.map((row) =>
    toTask(
      row,
      row.assignee_id ? profileMap.get(row.assignee_id) ?? null : null,
      tagsByTask.get(row.id) ?? [],
      workLogsByTask.get(row.id) ?? [],
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

  // gap 10: 중간값 삽입을 위해 신규는 항상 끝에 +10
  const sortOrder = (maxOrder?.sort_order ?? 0) + 10;

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
    .select(TASK_SELECT)
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
    .select(TASK_SELECT)
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

/** Board 전용: sort_order만 갱신 (parent_id 불변) */
export async function reorderTask(
  projectId: string,
  movedId: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, sort_order")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  const entries = (data ?? []).map((row) => ({
    id: row.id as string,
    sortOrder: row.sort_order as number,
  }));

  const updates = computeSortOrderUpdates(
    movedId,
    beforeId,
    afterId,
    entries,
  );

  if (updates.length === 0) return;

  if (updates.length === 1) {
    const [only] = updates;
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        sort_order: only.sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", only.id)
      .eq("project_id", projectId);

    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  // 다수 갱신은 RPC로 UPDATE 1회
  const { error: rpcError } = await supabase.rpc(
    "batch_update_task_sort_orders",
    {
      updates: updates.map((u) => ({
        id: u.id,
        sort_order: u.sortOrder,
      })),
    },
  );

  if (rpcError) {
    throw new Error(rpcError.message);
  }
}

/** Hierarchy 전용: parent_id만 갱신 (sort_order 불변) */
export async function setTaskParent(
  projectId: string,
  taskId: string,
  parentId: string | null,
): Promise<void> {
  if (parentId === taskId) {
    throw new Error("자기 자신을 상위 업무로 지정할 수 없습니다");
  }

  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  const tasks = ((rows ?? []) as TaskRow[]).map((row) =>
    toTask(row, null),
  );
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error("업무를 찾을 수 없습니다");
  }

  if (parentId !== null) {
    const parent = tasks.find((t) => t.id === parentId);
    if (!parent) {
      throw new Error("상위 업무를 찾을 수 없습니다");
    }
    if (isDescendantOf(tasks, taskId, parentId)) {
      throw new Error("하위 업무를 상위 업무로 지정할 수 없습니다");
    }
  }

  if (task.parentId === parentId) {
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("tasks")
    .update({
      parent_id: parentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("id, parent_id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }
  if (!updated) {
    throw new Error("상위 업무 변경이 반영되지 않았습니다");
  }
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
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
