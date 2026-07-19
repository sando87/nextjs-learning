import { createClient } from "@/lib/supabase/server";
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

  const { data, error } = await supabase
    .from("task_work_logs")
    .insert({
      task_id: input.taskId,
      started_at: start,
      ended_at: end,
      note: input.note?.trim() || null,
    })
    .select("id, task_id, started_at, ended_at, note")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toWorkLog(data as WorkLogRow);
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

  const row = existing as WorkLogRow;
  const startedAt = input.startedAt ?? row.started_at;
  const endedAt = input.endedAt ?? row.ended_at;
  const { start, end } = assertValidWorkLogRange(startedAt, endedAt);

  const { data, error } = await supabase
    .from("task_work_logs")
    .update({
      started_at: start,
      ended_at: end,
      note:
        input.note !== undefined ? input.note?.trim() || null : row.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workLogId)
    .select("id, task_id, started_at, ended_at, note")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toWorkLog(data as WorkLogRow);
}

export async function deleteWorkLog(workLogId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_work_logs")
    .delete()
    .eq("id", workLogId);

  if (error) {
    throw new Error(error.message);
  }
}
