"use client";

import ColumnVisibilityMenu from "@/components/schedule/ColumnVisibilityMenu";
import FilterPanel from "@/components/schedule/FilterPanel";
import type {
  BoardFilters,
  BoardLayout,
  ColumnKey,
  SortKey,
} from "@/components/schedule/schedule-board-state";
import type { ProjectMember, Tag, ViewMode } from "@/lib/schedule/types";

type ScheduleToolbarProps = {
  viewMode: ViewMode;
  boardLayout: BoardLayout;
  sortKey: SortKey;
  visibleColumns: Record<ColumnKey, boolean>;
  filters: BoardFilters;
  members: ProjectMember[];
  tags: Tag[];
  isReplayMode: boolean;
  showFullDayHours: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onBoardLayoutChange: (layout: BoardLayout) => void;
  onSortChange: (key: SortKey) => void;
  onColumnToggle: (key: ColumnKey) => void;
  onFilterChange: (filters: BoardFilters) => void;
  onAddTask: () => void;
  onReplayModeChange: (enabled: boolean) => void;
  onShowFullDayHoursChange: (enabled: boolean) => void;
  /** 오늘을 틀고정 우측 기준 위치로 스크롤 */
  onScrollToToday?: () => void;
  /** 과거 날짜 컬럼 7칸 추가 */
  onExtendPast?: () => void;
  /** 미래 날짜 컬럼 7칸 추가 */
  onExtendFuture?: () => void;
};

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "day", label: "일" },
  { value: "week", label: "주" },
  { value: "month", label: "월" },
];

const LAYOUT_OPTIONS: { value: BoardLayout; label: string }[] = [
  { value: "board", label: "Board" },
  { value: "hierarchy", label: "Hierarchy" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "sortOrder", label: "사용자 정렬" },
  { value: "priority", label: "우선순위" },
  { value: "startDate", label: "시작일" },
  { value: "status", label: "상태" },
  { value: "title", label: "이름" },
];

export default function ScheduleToolbar({
  viewMode,
  boardLayout,
  sortKey,
  visibleColumns,
  filters,
  members,
  tags,
  isReplayMode,
  showFullDayHours,
  onViewModeChange,
  onBoardLayoutChange,
  onSortChange,
  onColumnToggle,
  onFilterChange,
  onAddTask,
  onReplayModeChange,
  onShowFullDayHoursChange,
  onScrollToToday,
  onExtendPast,
  onExtendFuture,
}: ScheduleToolbarProps) {
  const isHierarchy = boardLayout === "hierarchy";
  const extendUnit =
    viewMode === "day" ? "일" : viewMode === "week" ? "주" : "개월";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      <div className="flex rounded border border-zinc-300 dark:border-zinc-700">
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={isReplayMode}
            onClick={() => onBoardLayoutChange(opt.value)}
            className={`px-3 py-1.5 text-sm disabled:opacity-40 ${
              boardLayout === opt.value
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex rounded border border-zinc-300 dark:border-zinc-700">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={isReplayMode}
            onClick={() => onViewModeChange(opt.value)}
            className={`px-3 py-1.5 text-sm disabled:opacity-40 ${
              viewMode === opt.value
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {onScrollToToday ? (
        <button
          type="button"
          onClick={onScrollToToday}
          title="오늘 기준으로 스크롤"
          className="rounded border border-rose-300 px-3 py-1.5 text-sm text-rose-700 dark:border-rose-800 dark:text-rose-300"
        >
          오늘
        </button>
      ) : null}

      {onExtendPast || onExtendFuture ? (
        <div className="flex rounded border border-zinc-300 dark:border-zinc-700">
          {onExtendPast ? (
            <button
              type="button"
              onClick={onExtendPast}
              title={`과거 7${extendUnit} 컬럼 추가`}
              className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400"
            >
              ← 과거 +7
            </button>
          ) : null}
          {onExtendPast && onExtendFuture ? (
            <span className="w-px self-stretch bg-zinc-300 dark:bg-zinc-700" />
          ) : null}
          {onExtendFuture ? (
            <button
              type="button"
              onClick={onExtendFuture}
              title={`미래 7${extendUnit} 컬럼 추가`}
              className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400"
            >
              미래 +7 →
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onShowFullDayHoursChange(!showFullDayHours)}
        title={
          showFullDayHours
            ? "전체시간(0시~24시) 표시 중 — 클릭하면 프로젝트 근무시간대로"
            : "프로젝트 근무시간대 표시 중 — 클릭하면 전체시간(0시~24시)"
        }
        className={`rounded border px-3 py-1.5 text-sm ${
          showFullDayHours
            ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
            : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        }`}
      >
        전체시간
      </button>

      <button
        type="button"
        onClick={() => onReplayModeChange(!isReplayMode)}
        className={`rounded border px-3 py-1.5 text-sm ${
          isReplayMode
            ? "border-rose-500 bg-rose-500 text-white"
            : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        }`}
      >
        Replay
      </button>
      <FilterPanel
        filters={filters}
        members={members}
        tags={tags}
        onChange={onFilterChange}
      />

      <ColumnVisibilityMenu
        visibleColumns={visibleColumns}
        onToggle={onColumnToggle}
      />

      {!isHierarchy && !isReplayMode ? (
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              정렬: {opt.label}
            </option>
          ))}
        </select>
      ) : null}

      {!isReplayMode ? (
        <button
          type="button"
          onClick={onAddTask}
          className="ml-auto rounded-full bg-zinc-950 px-4 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-950"
        >
          + 업무 추가
        </button>
      ) : (
        <span className="ml-auto text-xs text-zinc-500">
          주간 변경 이력 재생 중 · 편집 잠금
        </span>
      )}
    </div>
  );
}
