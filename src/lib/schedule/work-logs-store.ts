import { createClient } from "@/lib/supabase/server";
import {
  fieldChangeRows,
  insertScheduleChangeEvents,
} from "@/lib/schedule/schedule-change-events-store";
import {
  assertValidWorkLogRange,
  normalizeTimestamp,
} from "@/lib/schedule/work-log-utils";
import type { WorkLog } from "./types";

type WorkLogRow = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string;
  note: string | null;
};

async function currentActorId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function projectIdForTask(taskId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "업무를 찾을 수 없습니다");
  }

  return data.project_id as string;
}

/** worklog 변경 시 연결된 task.updated_at도 갱신 */
async function touchTaskUpdatedAt(taskId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    throw new Error(error.message);
  }
}

function toWorkLog(row: WorkLogRow): WorkLog {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: normalizeTimestamp(row.started_at),
    endedAt: normalizeTimestamp(row.ended_at),
    note: row.note,
  };
}

export async function getWorkLogsByTaskIds(
  taskIds: string[],
): Promise<Map<string, WorkLog[]>> {
  const map = new Map<string, WorkLog[]>();
  if (taskIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_work_logs")
    .select("id, task_id, started_at, ended_at, note")
    .in("task_id", taskIds)
    .order("started_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as WorkLogRow[]) {
    const log = toWorkLog(row);
    const list = map.get(log.taskId) ?? [];
    list.push(log);
    map.set(log.taskId, list);
  }

  return map;
}

export type CreateWorkLogInput = {
  taskId: string;
  startedAt: string;
  endedAt: string;
  note?: string | null;
};

export async function createWorkLog(input: CreateWorkLogInput): Promise<WorkLog> {
  const { start, end } = assertValidWorkLogRange(input.startedAt, input.endedAt);
  const supabase = await createClient();
  const projectId = await projectIdForTask(input.taskId);
  const note = input.note?.trim() || null;

  const { data, error } = await supabase
    .from("task_work_logs")
    .insert({
      task_id: input.taskId,
      started_at: start,
      ended_at: end,
      note,
    })
    .select("id, task_id, started_at, ended_at, note")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as WorkLogRow;
  await touchTaskUpdatedAt(row.task_id);
  const actorId = await currentActorId();
  await insertScheduleChangeEvents(
    fieldChangeRows(
      {
        projectId,
        entityType: "work_log",
        entityId: row.id,
        taskId: row.task_id,
        actorId,
      },
      "created",
      {
        started_at: { next: normalizeTimestamp(row.started_at) },
        ended_at: { next: normalizeTimestamp(row.ended_at) },
        note: { next: row.note },
      },
    ),
  );

  return toWorkLog(row);
}

export type UpdateWorkLogInput = {
  startedAt?: string;
  endedAt?: string;
  note?: string | null;
};

export async function updateWorkLog(
  workLogId: string,
  input: UpdateWorkLogInput,
): Promise<WorkLog> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("task_work_logs")
    .select("id, task_id, started_at, ended_at, note")
    .eq("id", workLogId)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message ?? "작업시간 기록을 찾을 수 없습니다");
  }

  const before = existing as WorkLogRow;
  const startedAt = input.startedAt ?? before.started_at;
  const endedAt = input.endedAt ?? before.ended_at;
  const { start, end } = assertValidWorkLogRange(startedAt, endedAt);
  const nextNote =
    input.note !== undefined ? input.note?.trim() || null : before.note;
  const projectId = await projectIdForTask(before.task_id);

  const { data, error } = await supabase
    .from("task_work_logs")
    .update({
      started_at: start,
      ended_at: end,
      note: nextNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workLogId)
    .select("id, task_id, started_at, ended_at, note")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as WorkLogRow;
  await touchTaskUpdatedAt(row.task_id);
  const actorId = await currentActorId();
  await insertScheduleChangeEvents(
    fieldChangeRows(
      {
        projectId,
        entityType: "work_log",
        entityId: row.id,
        taskId: row.task_id,
        actorId,
      },
      "updated",
      {
        started_at: {
          old: normalizeTimestamp(before.started_at),
          next: normalizeTimestamp(row.started_at),
        },
        ended_at: {
          old: normalizeTimestamp(before.ended_at),
          next: normalizeTimestamp(row.ended_at),
        },
        note: { old: before.note, next: row.note },
      },
    ),
  );

  return toWorkLog(row);
}

export async function deleteWorkLog(workLogId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("task_work_logs")
    .select("id, task_id, started_at, ended_at, note")
    .eq("id", workLogId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existing) {
    const row = existing as WorkLogRow;
    const projectId = await projectIdForTask(row.task_id);
    const actorId = await currentActorId();
    await insertScheduleChangeEvents(
      fieldChangeRows(
        {
          projectId,
          entityType: "work_log",
          entityId: row.id,
          taskId: row.task_id,
          actorId,
        },
        "deleted",
        {
          started_at: { old: normalizeTimestamp(row.started_at) },
          ended_at: { old: normalizeTimestamp(row.ended_at) },
          note: { old: row.note },
        },
      ),
    );
  }

  const { error } = await supabase
    .from("task_work_logs")
    .delete()
    .eq("id", workLogId);

  if (error) {
    throw new Error(error.message);
  }

  if (existing) {
    await touchTaskUpdatedAt((existing as WorkLogRow).task_id);
  }
}
