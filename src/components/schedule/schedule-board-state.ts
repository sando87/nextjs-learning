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

export const DEFAULT_DAY_COLUMN_WIDTH = 144;
export const MIN_DAY_COLUMN_WIDTH = 72;
export const MAX_DAY_COLUMN_WIDTH = 480;
export const DAY_COLUMN_WIDTH_STEP = 24;

export const DEFAULT_WEEK_COLUMN_WIDTH = 168;
export const MIN_WEEK_COLUMN_WIDTH = 72;
export const MAX_WEEK_COLUMN_WIDTH = 560;
export const WEEK_COLUMN_WIDTH_STEP = 24;

export const DEFAULT_MONTH_COLUMN_WIDTH = 200;
export const MIN_MONTH_COLUMN_WIDTH = 72;
export const MAX_MONTH_COLUMN_WIDTH = 720;
export const MONTH_COLUMN_WIDTH_STEP = 24;

export type BoardPreferences = {
  viewMode: "day" | "week" | "month";
  sortKey: SortKey;
  visibleColumns: Record<ColumnKey, boolean>;
  filters: BoardFilters;
  dayColumnWidth: number;
  weekColumnWidth: number;
  monthColumnWidth: number;
};

function clampDayColumnWidth(width: number): number {
  return Math.min(
    MAX_DAY_COLUMN_WIDTH,
    Math.max(MIN_DAY_COLUMN_WIDTH, Math.round(width)),
  );
}

function clampWeekColumnWidth(width: number): number {
  return Math.min(
    MAX_WEEK_COLUMN_WIDTH,
    Math.max(MIN_WEEK_COLUMN_WIDTH, Math.round(width)),
  );
}

function clampMonthColumnWidth(width: number): number {
  return Math.min(
    MAX_MONTH_COLUMN_WIDTH,
    Math.max(MIN_MONTH_COLUMN_WIDTH, Math.round(width)),
  );
}

export function getStorageKey(projectId: string) {
  return `schedule-board-${projectId}`;
}

export function loadBoardPreferences(projectId: string): Partial<BoardPreferences> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      viewMode?: string;
      sortKey?: SortKey;
      visibleColumns?: Partial<Record<ColumnKey, boolean>>;
      filters?: BoardFilters;
      dayColumnWidth?: number;
      weekColumnWidth?: number;
      monthColumnWidth?: number;
    };
    const result: Partial<BoardPreferences> = {};

    if (parsed.viewMode === "hour" || parsed.viewMode === "day") {
      result.viewMode = "day";
    } else if (parsed.viewMode === "week" || parsed.viewMode === "month") {
      result.viewMode = parsed.viewMode;
    }

    if (parsed.sortKey) result.sortKey = parsed.sortKey;
    if (parsed.visibleColumns) {
      result.visibleColumns = parsed.visibleColumns as BoardPreferences["visibleColumns"];
    }
    if (parsed.filters) result.filters = parsed.filters;
    if (typeof parsed.dayColumnWidth === "number") {
      result.dayColumnWidth = clampDayColumnWidth(parsed.dayColumnWidth);
    }
    if (typeof parsed.weekColumnWidth === "number") {
      result.weekColumnWidth = clampWeekColumnWidth(parsed.weekColumnWidth);
    }
    if (typeof parsed.monthColumnWidth === "number") {
      result.monthColumnWidth = clampMonthColumnWidth(parsed.monthColumnWidth);
    }
    return result;
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

export {
  clampDayColumnWidth,
  clampWeekColumnWidth,
  clampMonthColumnWidth,
};
