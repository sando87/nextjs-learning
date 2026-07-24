import { createClient } from "@/lib/supabase/server";
import type {
  ScheduleChangeEvent,
  ScheduleEntityType,
  ScheduleEventType,
} from "./types";

type ChangeEventRow = {
  id: string;
  project_id: string;
  entity_type: ScheduleEntityType;
  entity_id: string;
  task_id: string | null;
  actor_id: string | null;
  event_type: ScheduleEventType;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type ChangeEventInsert = {
  projectId: string;
  entityType: ScheduleEntityType;
  entityId: string;
  taskId: string | null;
  actorId: string | null;
  eventType: ScheduleEventType;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
};

function toEvent(row: ChangeEventRow): ScheduleChangeEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    taskId: row.task_id,
    actorId: row.actor_id,
    eventType: row.event_type,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at,
  };
}

function serializeValue(value: string | number | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

/** 필드별 created/updated 이벤트 행 생성 */
export function fieldChangeRows(
  base: Omit<ChangeEventInsert, "eventType" | "field" | "oldValue" | "newValue">,
  eventType: ScheduleEventType,
  fields: Record<string, { old?: string | number | null; next?: string | number | null }>,
): ChangeEventInsert[] {
  const rows: ChangeEventInsert[] = [];
  for (const [field, values] of Object.entries(fields)) {
    const oldValue = serializeValue(values.old);
    const newValue = serializeValue(values.next);
    if (eventType === "updated" && oldValue === newValue) continue;
    rows.push({
      ...base,
      eventType,
      field,
      oldValue,
      newValue,
    });
  }
  return rows;
}

export async function insertScheduleChangeEvents(
  events: ChangeEventInsert[],
): Promise<void> {
  if (events.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_change_events").insert(
    events.map((e) => ({
      project_id: e.projectId,
      entity_type: e.entityType,
      entity_id: e.entityId,
      task_id: e.taskId,
      actor_id: e.actorId,
      event_type: e.eventType,
      field: e.field ?? null,
      old_value: e.oldValue ?? null,
      new_value: e.newValue ?? null,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getScheduleChangeEvents(
  projectId: string,
  fromIso: string,
  toIso: string,
): Promise<ScheduleChangeEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_change_events")
    .select(
      "id, project_id, entity_type, entity_id, task_id, actor_id, event_type, field, old_value, new_value, created_at",
    )
    .eq("project_id", projectId)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ChangeEventRow[]).map(toEvent);
}

/** 복원용: 주간 창 + 해당 entity의 이전 이벤트까지 포함 */
export async function getScheduleChangeEventsForReplay(
  projectId: string,
  weekStartIso: string,
  weekEndIso: string,
): Promise<ScheduleChangeEvent[]> {
  const supabase = await createClient();

  // 주간에 발생한 이벤트
  const { data: weekRows, error: weekError } = await supabase
    .from("schedule_change_events")
    .select(
      "id, project_id, entity_type, entity_id, task_id, actor_id, event_type, field, old_value, new_value, created_at",
    )
    .eq("project_id", projectId)
    .gte("created_at", weekStartIso)
    .lte("created_at", weekEndIso)
    .order("created_at", { ascending: true });

  if (weekError) {
    throw new Error(weekError.message);
  }

  const weekEvents = (weekRows ?? []) as ChangeEventRow[];
  const entityKeys = new Set(
    weekEvents.map((e) => `${e.entity_type}:${e.entity_id}`),
  );

  // 주에 이벤트가 없어도 레거시 폴백은 클라이언트에서 처리.
  // 주에 이벤트가 있는 entity는 주 시작 이전 이력도 필요.
  if (entityKeys.size === 0) {
    return weekEvents.map(toEvent);
  }

  const entityIds = [...new Set(weekEvents.map((e) => e.entity_id))];
  const { data: priorRows, error: priorError } = await supabase
    .from("schedule_change_events")
    .select(
      "id, project_id, entity_type, entity_id, task_id, actor_id, event_type, field, old_value, new_value, created_at",
    )
    .eq("project_id", projectId)
    .in("entity_id", entityIds)
    .lt("created_at", weekStartIso)
    .order("created_at", { ascending: true });

  if (priorError) {
    throw new Error(priorError.message);
  }

  const prior = ((priorRows ?? []) as ChangeEventRow[]).filter((e) =>
    entityKeys.has(`${e.entity_type}:${e.entity_id}`),
  );

  const byId = new Map<string, ChangeEventRow>();
  for (const row of [...prior, ...weekEvents]) {
    byId.set(row.id, row);
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .map(toEvent);
}
