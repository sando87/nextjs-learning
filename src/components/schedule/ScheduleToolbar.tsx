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
  onViewModeChange: (mode: ViewMode) => void;
  onBoardLayoutChange: (layout: BoardLayout) => void;
  onSortChange: (key: SortKey) => void;
  onColumnToggle: (key: ColumnKey) => void;
  onFilterChange: (filters: BoardFilters) => void;
  onAddTask: () => void;
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
  onViewModeChange,
  onBoardLayoutChange,
  onSortChange,
  onColumnToggle,
  onFilterChange,
  onAddTask,
}: ScheduleToolbarProps) {
  const isHierarchy = boardLayout === "hierarchy";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      <div className="flex rounded border border-zinc-300 dark:border-zinc-700">
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onBoardLayoutChange(opt.value)}
            className={`px-3 py-1.5 text-sm ${
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
            onClick={() => onViewModeChange(opt.value)}
            className={`px-3 py-1.5 text-sm ${
              viewMode === opt.value
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

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

      {!isHierarchy ? (
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

      <button
        type="button"
        onClick={onAddTask}
        className="ml-auto rounded-full bg-zinc-950 px-4 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-950"
      >
        + 업무 추가
      </button>
    </div>
  );
}
