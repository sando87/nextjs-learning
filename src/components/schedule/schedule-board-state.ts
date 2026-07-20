export type ColumnKey =
  | "worker"
  | "state"
  | "priority"
  | "tags"
  | "links"
  | "workHours";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  worker: "Worker",
  state: "State",
  priority: "Priority",
  tags: "Tags",
  links: "Links",
  workHours: "WorkHours",
};

export const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  worker: true,
  state: true,
  priority: false,
  tags: true,
  links: false,
  workHours: true,
};

export type SortKey =
  | "sortOrder"
  | "priority"
  | "startDate"
  | "status"
  | "title";

export type BoardFilters = {
  assigneeIds: string[];
  statuses: string[];
  tagIds: string[];
};

export const DEFAULT_FILTERS: BoardFilters = {
  assigneeIds: [],
  statuses: [],
  tagIds: [],
};

export type BoardPreferences = {
  viewMode: "hour" | "day" | "week" | "month";
  sortKey: SortKey;
  visibleColumns: Record<ColumnKey, boolean>;
  filters: BoardFilters;
};

export function getStorageKey(projectId: string) {
  return `schedule-board-${projectId}`;
}

export function loadBoardPreferences(projectId: string): Partial<BoardPreferences> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    return raw ? (JSON.parse(raw) as Partial<BoardPreferences>) : {};
  } catch {
    return {};
  }
}

export function saveBoardPreferences(
  projectId: string,
  prefs: BoardPreferences,
) {
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(prefs));
}
