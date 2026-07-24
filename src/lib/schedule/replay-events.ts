import type {
  ScheduleChangeEvent,
  Task,
  TaskStatus,
  WorkLog,
} from "./types";

export type ReconstructedWorkLog = WorkLog;

export type ReconstructedTaskFields = {
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  parentId: string | null;
};

export type ReplayState = {
  workLogs: Map<string, ReconstructedWorkLog>;
  /** 이력이 있는 task만. 없으면 현재 스냅샷 사용 */
  tasks: Map<string, Partial<ReconstructedTaskFields>>;
  /** entity에 이벤트가 한 건이라도 있으면 true (레거시 폴백 제외용) */
  touchedWorkLogIds: Set<string>;
  touchedTaskIds: Set<string>;
};

function parsePlayheadMs(isoOrLocal: string): number {
  const t = Date.parse(isoOrLocal);
  return Number.isNaN(t) ? 0 : t;
}

function applyWorkLogField(
  log: ReconstructedWorkLog,
  field: string | null,
  value: string | null,
): ReconstructedWorkLog {
  if (!field) return log;
  switch (field) {
    case "started_at":
      return { ...log, startedAt: value ?? log.startedAt };
    case "ended_at":
      return { ...log, endedAt: value ?? log.endedAt };
    case "note":
      return { ...log, note: value };
    default:
      return log;
  }
}

function applyTaskField(
  fields: Partial<ReconstructedTaskFields>,
  field: string | null,
  value: string | null,
): Partial<ReconstructedTaskFields> {
  if (!field) return fields;
  switch (field) {
    case "title":
      return { ...fields, title: value ?? fields.title };
    case "status":
      return {
        ...fields,
        status: (value as TaskStatus | null) ?? fields.status,
      };
    case "assignee_id":
      return { ...fields, assigneeId: value };
    case "start_date":
      return { ...fields, startDate: value };
    case "end_date":
      return { ...fields, endDate: value };
    case "priority":
      return {
        ...fields,
        priority: value != null ? Number(value) : fields.priority,
      };
    case "parent_id":
      return { ...fields, parentId: value };
    default:
      return fields;
  }
}

function taskHasField(
  fields: Partial<ReconstructedTaskFields>,
  field: string,
): boolean {
  switch (field) {
    case "title":
      return fields.title !== undefined;
    case "status":
      return fields.status !== undefined;
    case "assignee_id":
      return Object.prototype.hasOwnProperty.call(fields, "assigneeId");
    case "start_date":
      return Object.prototype.hasOwnProperty.call(fields, "startDate");
    case "end_date":
      return Object.prototype.hasOwnProperty.call(fields, "endDate");
    case "priority":
      return fields.priority !== undefined;
    case "parent_id":
      return Object.prototype.hasOwnProperty.call(fields, "parentId");
    default:
      return false;
  }
}

function workLogHasField(log: ReconstructedWorkLog, field: string): boolean {
  switch (field) {
    case "started_at":
      return Boolean(log.startedAt);
    case "ended_at":
      return Boolean(log.endedAt);
    case "note":
      return true;
    default:
      return false;
  }
}

/**
 * update 이벤트의 첫 old_value로 시드 — playhead가 변경 이전이면
 * 현재 스냅샷이 아니라 변경 전 값이 보이도록.
 */
function seedFromUpdateOldValues(events: ScheduleChangeEvent[]): {
  workLogs: Map<string, ReconstructedWorkLog>;
  tasks: Map<string, Partial<ReconstructedTaskFields>>;
} {
  const workLogs = new Map<string, ReconstructedWorkLog>();
  const tasks = new Map<string, Partial<ReconstructedTaskFields>>();
  const workLogNoteSeeded = new Set<string>();

  for (const event of events) {
    if (event.eventType !== "updated" || !event.field) continue;

    if (event.entityType === "task") {
      const existing = tasks.get(event.entityId) ?? {};
      if (taskHasField(existing, event.field)) continue;
      tasks.set(
        event.entityId,
        applyTaskField(existing, event.field, event.oldValue),
      );
      continue;
    }

    if (event.entityType === "work_log") {
      const existing = workLogs.get(event.entityId) ?? {
        id: event.entityId,
        taskId: event.taskId ?? "",
        startedAt: "",
        endedAt: "",
        note: null,
      };
      if (event.taskId) existing.taskId = event.taskId;

      if (event.field === "note") {
        if (workLogNoteSeeded.has(event.entityId)) continue;
        workLogNoteSeeded.add(event.entityId);
      } else if (workLogHasField(existing, event.field)) {
        continue;
      }

      workLogs.set(
        event.entityId,
        applyWorkLogField(existing, event.field, event.oldValue),
      );
    }
  }

  return { workLogs, tasks };
}

/** playhead 시각까지 이벤트를 적용해 work_log / task 부분 상태 복원 */
export function applyEventsUpTo(
  events: ScheduleChangeEvent[],
  playheadIso: string,
): ReplayState {
  const playheadMs = parsePlayheadMs(playheadIso);
  const touchedWorkLogIds = new Set<string>();
  const touchedTaskIds = new Set<string>();

  for (const event of events) {
    if (event.entityType === "work_log") {
      touchedWorkLogIds.add(event.entityId);
    } else if (event.entityType === "task") {
      touchedTaskIds.add(event.entityId);
    }
  }

  const seeded = seedFromUpdateOldValues(events);
  const workLogs = new Map(seeded.workLogs);
  const tasks = new Map(seeded.tasks);

  for (const event of events) {
    if (parsePlayheadMs(event.createdAt) > playheadMs) continue;

    if (event.entityType === "work_log") {
      if (event.eventType === "deleted") {
        workLogs.delete(event.entityId);
        continue;
      }

      const existing = workLogs.get(event.entityId) ?? {
        id: event.entityId,
        taskId: event.taskId ?? "",
        startedAt: "",
        endedAt: "",
        note: null,
      };
      if (event.taskId) existing.taskId = event.taskId;

      const value =
        event.eventType === "created" || event.eventType === "updated"
          ? event.newValue
          : event.oldValue;
      workLogs.set(
        event.entityId,
        applyWorkLogField(existing, event.field, value),
      );
      continue;
    }

    if (event.entityType === "task") {
      if (event.eventType === "deleted") {
        tasks.delete(event.entityId);
        continue;
      }

      const existing = tasks.get(event.entityId) ?? {};
      const value =
        event.eventType === "created" || event.eventType === "updated"
          ? event.newValue
          : event.oldValue;
      tasks.set(
        event.entityId,
        applyTaskField(existing, event.field, value),
      );
    }
  }

  return { workLogs, tasks, touchedWorkLogIds, touchedTaskIds };
}

/** 피드용: playhead 이하 이벤트 (시간순) */
export function getEventsUpTo(
  events: ScheduleChangeEvent[],
  playheadIso: string,
): ScheduleChangeEvent[] {
  const playheadMs = parsePlayheadMs(playheadIso);
  return events.filter((e) => parsePlayheadMs(e.createdAt) <= playheadMs);
}

/**
 * 복원 상태 + 레거시(이벤트 없는) 현재 work_log 병합.
 * 불완전한 복원(시작/종료 없음)은 제외.
 */
export function mergeWorkLogsForReplay(
  state: ReplayState,
  currentLogs: WorkLog[],
): WorkLog[] {
  const result = new Map<string, WorkLog>();

  for (const log of currentLogs) {
    if (!state.touchedWorkLogIds.has(log.id)) {
      result.set(log.id, log);
    }
  }

  for (const [id, log] of state.workLogs) {
    if (!log.startedAt || !log.endedAt || !log.taskId) continue;
    result.set(id, log);
  }

  return [...result.values()].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
}

function pickPatched<T>(
  patch: Partial<ReconstructedTaskFields> | undefined,
  key: keyof ReconstructedTaskFields,
  fallback: T,
): T {
  if (!patch || !Object.prototype.hasOwnProperty.call(patch, key)) {
    return fallback;
  }
  return patch[key] as T;
}

/** 현재 tasks에 복원된 workLogs(및 task 필드) 덮어쓰기 */
export function tasksWithReplayedWorkLogs(
  tasks: Task[],
  replayedLogs: WorkLog[],
  state: ReplayState,
): Task[] {
  const byTask = new Map<string, WorkLog[]>();
  for (const log of replayedLogs) {
    const list = byTask.get(log.taskId) ?? [];
    list.push(log);
    byTask.set(log.taskId, list);
  }

  const result: Task[] = [];
  for (const task of tasks) {
    // 이력이 있는데 playhead 시점에 맵에 없음 = 아직 생성 전 또는 삭제됨
    if (state.touchedTaskIds.has(task.id) && !state.tasks.has(task.id)) {
      continue;
    }

    const patch = state.tasks.get(task.id);
    const usePatch = state.touchedTaskIds.has(task.id) && patch;

    result.push({
      ...task,
      title: usePatch ? pickPatched(patch, "title", task.title) : task.title,
      status: usePatch ? pickPatched(patch, "status", task.status) : task.status,
      assigneeId: usePatch
        ? pickPatched(patch, "assigneeId", task.assigneeId)
        : task.assigneeId,
      startDate: usePatch
        ? pickPatched(patch, "startDate", task.startDate)
        : task.startDate,
      endDate: usePatch
        ? pickPatched(patch, "endDate", task.endDate)
        : task.endDate,
      priority: usePatch
        ? pickPatched(patch, "priority", task.priority)
        : task.priority,
      parentId: usePatch
        ? pickPatched(patch, "parentId", task.parentId)
        : task.parentId,
      workLogs: byTask.get(task.id) ?? [],
    });
  }

  return result;
}

const FIELD_LABELS: Record<string, string> = {
  title: "이름",
  status: "상태",
  assignee_id: "담당자",
  start_date: "시작일",
  end_date: "종료일",
  priority: "우선순위",
  parent_id: "상위 업무",
  started_at: "시작",
  ended_at: "종료",
  note: "노트",
};

export function formatReplayEventSummary(
  event: ScheduleChangeEvent,
  taskTitleById: Map<string, string>,
): string {
  const taskLabel =
    (event.taskId && taskTitleById.get(event.taskId)) ||
    (event.entityType === "task"
      ? taskTitleById.get(event.entityId)
      : null) ||
    "업무";

  if (event.eventType === "created") {
    if (event.entityType === "work_log") {
      const field = event.field ? FIELD_LABELS[event.field] ?? event.field : "";
      return `${taskLabel}: 작업시간 추가${field && event.newValue ? ` (${field} ${event.newValue})` : ""}`;
    }
    return `${taskLabel}: 업무 생성${event.field === "title" && event.newValue ? ` — ${event.newValue}` : ""}`;
  }

  if (event.eventType === "deleted") {
    return event.entityType === "work_log"
      ? `${taskLabel}: 작업시간 삭제`
      : `${taskLabel}: 업무 삭제`;
  }

  const field = event.field ? FIELD_LABELS[event.field] ?? event.field : "필드";
  const from = event.oldValue ?? "—";
  const to = event.newValue ?? "—";
  return `${taskLabel}: ${field} ${from} → ${to}`;
}
