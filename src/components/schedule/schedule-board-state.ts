export type ColumnKey =
  | "worker"
  | "state"
  | "priority"
  | "tags"
  | "workHours";

export type MetaColumnKey = ColumnKey | "title";

export type BoardLayout = "board" | "hierarchy";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  worker: "Worker",
  state: "State",
  priority: "Priority",
  tags: "Tags",
  workHours: "WorkHours",
};

export const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  worker: true,
  state: true,
  priority: false,
  tags: true,
  workHours: true,
};

/** sticky left 누적 계산용 — 셀/헤더 min-width와 동일하게 유지 */
export const META_COLUMN_WIDTHS: Record<MetaColumnKey, number> = {
  title: 160,
  worker: 100,
  state: 80,
  priority: 56,
  tags: 120,
  workHours: 64,
};

const META_COLUMN_ORDER: MetaColumnKey[] = [
  "title",
  "worker",
  "state",
  "priority",
  "tags",
  "workHours",
];

/** 보이는 메타 열마다 sticky `left` (px). 숨긴 열은 맵에 없음 */
export function getMetaStickyLefts(
  visibleColumns: Record<ColumnKey, boolean>,
): Partial<Record<MetaColumnKey, number>> {
  let left = 0;
  const result: Partial<Record<MetaColumnKey, number>> = {};
  for (const key of META_COLUMN_ORDER) {
    if (key !== "title" && !visibleColumns[key]) continue;
    result[key] = left;
    // 1px 겹쳐 열 사이 border 틈으로 타임라인이 비치지 않게 함
    left += META_COLUMN_WIDTHS[key] - 1;
  }
  return result;
}

/** 틀 고정 영역 맨 오른쪽 열 — 타임라인과 구분선용 */
export function getLastVisibleMetaKey(
  visibleColumns: Record<ColumnKey, boolean>,
): MetaColumnKey {
  let last: MetaColumnKey = "title";
  for (const key of META_COLUMN_ORDER) {
    if (key !== "title" && !visibleColumns[key]) continue;
    last = key;
  }
  return last;
}

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
  boardLayout: BoardLayout;
  sortKey: SortKey;
  visibleColumns: Record<ColumnKey, boolean>;
  filters: BoardFilters;
  dayColumnWidth: number;
  weekColumnWidth: number;
  monthColumnWidth: number;
  collapsedIds: string[];
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
      boardLayout?: string;
      sortKey?: SortKey;
      visibleColumns?: Partial<Record<ColumnKey, boolean>>;
      filters?: BoardFilters;
      dayColumnWidth?: number;
      weekColumnWidth?: number;
      monthColumnWidth?: number;
      collapsedIds?: string[];
    };
    const result: Partial<BoardPreferences> = {};

    if (parsed.viewMode === "hour" || parsed.viewMode === "day") {
      result.viewMode = "day";
    } else if (parsed.viewMode === "week" || parsed.viewMode === "month") {
      result.viewMode = parsed.viewMode;
    }

    if (parsed.boardLayout === "board" || parsed.boardLayout === "hierarchy") {
      result.boardLayout = parsed.boardLayout;
    }

    if (parsed.sortKey) result.sortKey = parsed.sortKey;
    if (parsed.visibleColumns) {
      const cleaned = { ...parsed.visibleColumns };
      delete (cleaned as { links?: boolean }).links;
      result.visibleColumns = {
        ...DEFAULT_VISIBLE_COLUMNS,
        ...cleaned,
      };
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
    if (Array.isArray(parsed.collapsedIds)) {
      result.collapsedIds = parsed.collapsedIds.filter(
        (id): id is string => typeof id === "string",
      );
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
