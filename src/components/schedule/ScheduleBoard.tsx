"use client";

import ScheduleToolbar from "@/components/schedule/ScheduleToolbar";
import TaskForm from "@/components/schedule/TaskForm";
import TaskMetaCells from "@/components/schedule/TaskMetaCells";
import TimelineCells from "@/components/schedule/TimelineCells";
import TimelineHeader from "@/components/schedule/TimelineHeader";
import {
  COLUMN_LABELS,
  DEFAULT_FILTERS,
  DEFAULT_VISIBLE_COLUMNS,
  loadBoardPreferences,
  saveBoardPreferences,
  type BoardFilters,
  type ColumnKey,
  type SortKey,
} from "@/components/schedule/schedule-board-state";
import { generateTimelineColumns } from "@/lib/schedule/timeline-utils";
import type {
  Project,
  ProjectMember,
  Tag,
  Task,
  ViewMode,
} from "@/lib/schedule/types";
import { useMemo, useState } from "react";

type ScheduleBoardProps = {
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
  tags: Tag[];
};

const COLUMN_WIDTH = 72;
const HOUR_COLUMN_WIDTH = 36;

/** undefined=닫힘, null=신규, string=수정 대상 id */
type EditingTarget = string | null | undefined;

function applyFilters(tasks: Task[], filters: BoardFilters) {
  return tasks.filter((task) => {
    if (
      filters.assigneeIds.length > 0 &&
      (!task.assigneeId || !filters.assigneeIds.includes(task.assigneeId))
    ) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }
    if (
      filters.tagIds.length > 0 &&
      !task.tags.some((t) => filters.tagIds.includes(t.id))
    ) {
      return false;
    }
    return true;
  });
}

function sortTasks(tasks: Task[], sortKey: SortKey) {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (sortKey === "priority") return a.priority - b.priority;
    if (sortKey === "title") return a.title.localeCompare(b.title);
    if (sortKey === "status") return a.status.localeCompare(b.status);
    const aDate = a.startDate ?? "9999-99-99";
    const bDate = b.startDate ?? "9999-99-99";
    return aDate.localeCompare(bDate);
  });
  return copy;
}

export default function ScheduleBoard({
  project,
  tasks,
  members,
  tags,
}: ScheduleBoardProps) {
  const saved = loadBoardPreferences(project.id);

  const [viewMode, setViewMode] = useState<ViewMode>(saved.viewMode ?? "week");
  const [sortKey, setSortKey] = useState<SortKey>(saved.sortKey ?? "priority");
  const [visibleColumns, setVisibleColumns] = useState({
    ...DEFAULT_VISIBLE_COLUMNS,
    ...(saved.visibleColumns ?? {}),
  });
  const [filters, setFilters] = useState<BoardFilters>(
    saved.filters ?? DEFAULT_FILTERS,
  );
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(undefined);

  const editingTask: Task | null | undefined =
    editingTarget === undefined
      ? undefined
      : editingTarget === null
        ? null
        : tasks.find((t) => t.id === editingTarget);

  const persist = (
    next: Partial<{
      viewMode: ViewMode;
      sortKey: SortKey;
      visibleColumns: Record<ColumnKey, boolean>;
      filters: BoardFilters;
    }>,
  ) => {
    saveBoardPreferences(project.id, {
      viewMode: next.viewMode ?? viewMode,
      sortKey: next.sortKey ?? sortKey,
      visibleColumns: next.visibleColumns ?? visibleColumns,
      filters: next.filters ?? filters,
    });
  };

  const columns = useMemo(
    () =>
      generateTimelineColumns(
        viewMode,
        project.startDate,
        tasks.map((t) => t.endDate),
        14,
        tasks.flatMap((t) => t.workLogs.map((log) => log.endedAt)),
      ),
    [viewMode, project.startDate, tasks],
  );

  const columnWidth = viewMode === "hour" ? HOUR_COLUMN_WIDTH : COLUMN_WIDTH;

  const visibleTasks = useMemo(
    () => sortTasks(applyFilters(tasks, filters), sortKey),
    [tasks, filters, sortKey],
  );

  const metaHeaders: { key: ColumnKey | "title"; label: string }[] = [
    { key: "title", label: "WorkUnit" },
    ...(Object.keys(COLUMN_LABELS) as ColumnKey[])
      .filter((k) => visibleColumns[k])
      .map((k) => ({ key: k, label: COLUMN_LABELS[k] })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <ScheduleToolbar
        viewMode={viewMode}
        sortKey={sortKey}
        visibleColumns={visibleColumns}
        filters={filters}
        members={members}
        tags={tags}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          persist({ viewMode: mode });
        }}
        onSortChange={(key) => {
          setSortKey(key);
          persist({ sortKey: key });
        }}
        onColumnToggle={(key) => {
          const next = { ...visibleColumns, [key]: !visibleColumns[key] };
          setVisibleColumns(next);
          persist({ visibleColumns: next });
        }}
        onFilterChange={(next) => {
          setFilters(next);
          persist({ filters: next });
        }}
        onAddTask={() => setEditingTarget(null)}
      />

      <div className="overflow-x-auto rounded border border-zinc-300 dark:border-zinc-700">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {metaHeaders.map((col) => (
                <th
                  key={col.key}
                  className={`border border-zinc-300 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900 ${
                    col.key === "title" ? "sticky left-0 z-10" : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
              <TimelineHeader columns={columns} columnWidth={columnWidth} />
            </tr>
          </thead>
          <tbody>
            {visibleTasks.length === 0 ? (
              <tr>
                <td
                  colSpan={metaHeaders.length + columns.length}
                  className="border border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700"
                >
                  {tasks.length === 0
                    ? "업무가 없습니다. [Add New Work]로 추가하세요."
                    : "필터 조건에 맞는 업무가 없습니다."}
                </td>
              </tr>
            ) : (
              visibleTasks.map((task) => (
                <tr key={task.id}>
                  <TaskMetaCells
                    task={task}
                    projectId={project.id}
                    members={members}
                    visibleColumns={visibleColumns}
                    allTasks={tasks}
                    onEdit={(t) => setEditingTarget(t.id)}
                  />
                  <TimelineCells
                    task={task}
                    columns={columns}
                    columnWidth={columnWidth}
                    viewMode={viewMode}
                  />
                </tr>
              ))
            )}
            <tr>
              <td
                colSpan={metaHeaders.length + columns.length}
                className="border border-zinc-300 px-2 py-2 text-center text-xs text-zinc-500 dark:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="hover:underline"
                >
                  [Add New Work]
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {editingTask !== undefined ? (
        <TaskForm
          projectId={project.id}
          members={members}
          tags={tags}
          allTasks={tasks}
          task={editingTask}
          onClose={() => setEditingTarget(undefined)}
        />
      ) : null}
    </div>
  );
}
