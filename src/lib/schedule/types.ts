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
  createdAt: string;
};

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
  tags: Tag[];
  linkedTaskIds: string[];
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
