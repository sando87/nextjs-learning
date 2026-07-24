export const TASK_STATUSES = ["planned", "doing", "done", "hold"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const VIEW_MODES = ["day", "week", "month"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export type ProjectRole = "owner" | "member";

export type Profile = {
  id: string;
  email: string;
  displayName: string;
};

export type Project = {
  id: string;
  name: string;
  ownerId: string;
  startDate: string;
  /** 일 뷰 기본 표시 시작 시 (0–23, half-open) */
  workdayStartHour: number;
  /** 일 뷰 기본 표시 종료 시 (1–24, half-open) */
  workdayEndHour: number;
  createdAt: string;
};

export const DEFAULT_WORKDAY_START_HOUR = 9;
export const DEFAULT_WORKDAY_END_HOUR = 18;

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  profile: Profile;
};

export type Tag = {
  id: string;
  projectId: string;
  name: string;
  color: string;
};

export type WorkLog = {
  id: string;
  taskId: string;
  /** YYYY-MM-DDTHH:mm:ss (시 단위, timezone 없음) */
  startedAt: string;
  endedAt: string;
  note: string | null;
};

export const SCHEDULE_ENTITY_TYPES = ["task", "work_log"] as const;
export type ScheduleEntityType = (typeof SCHEDULE_ENTITY_TYPES)[number];

export const SCHEDULE_EVENT_TYPES = ["created", "updated", "deleted"] as const;
export type ScheduleEventType = (typeof SCHEDULE_EVENT_TYPES)[number];

export type ScheduleChangeEvent = {
  id: string;
  projectId: string;
  entityType: ScheduleEntityType;
  entityId: string;
  taskId: string | null;
  actorId: string | null;
  eventType: ScheduleEventType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  /** ISO timestamptz */
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string | null;
  assignee: Profile | null;
  status: TaskStatus;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  sortOrder: number;
  parentId: string | null;
  createdAt: string;
  /** ISO timestamptz — 완료 업무 차트 윈도우 필터 기준 */
  updatedAt: string;
  tags: Tag[];
  workLogs: WorkLog[];
};

export type TimelineColumn = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "예정",
  doing: "진행중",
  done: "완료",
  hold: "보류",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  planned: "border-zinc-400 bg-transparent",
  doing: "bg-orange-400 border-orange-500",
  done: "bg-green-500 border-green-600",
  hold: "bg-zinc-400 border-zinc-500",
};
