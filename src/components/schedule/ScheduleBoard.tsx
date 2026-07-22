"use client";

import { reorderTaskAction } from "@/app/schedule/actions";
import ScheduleToolbar from "@/components/schedule/ScheduleToolbar";
import TaskForm from "@/components/schedule/TaskForm";
import TaskMetaCells from "@/components/schedule/TaskMetaCells";
import TimelineCells from "@/components/schedule/TimelineCells";
import TimelineHeader from "@/components/schedule/TimelineHeader";
import {
  applyFilters,
  neighborsAtInsert,
  resolveSortKey,
  showIndicatorAbove,
  showIndicatorBelow,
  sortTasks,
  toInsertIndex,
} from "@/components/schedule/schedule-board-tasks";
import {
  clampDayColumnWidth,
  clampMonthColumnWidth,
  clampWeekColumnWidth,
  COLUMN_LABELS,
  DAY_COLUMN_WIDTH_STEP,
  DEFAULT_DAY_COLUMN_WIDTH,
  DEFAULT_FILTERS,
  DEFAULT_MONTH_COLUMN_WIDTH,
  DEFAULT_VISIBLE_COLUMNS,
  DEFAULT_WEEK_COLUMN_WIDTH,
  loadBoardPreferences,
  MONTH_COLUMN_WIDTH_STEP,
  saveBoardPreferences,
  WEEK_COLUMN_WIDTH_STEP,
  type BoardFilters,
  type ColumnKey,
  type SortKey,
} from "@/components/schedule/schedule-board-state";
import { generateTimelineColumns } from "@/lib/schedule/timeline-utils";
import {
  buildDayColumnLayouts,
  type DaySessionExpand,
} from "@/lib/schedule/day-workday-layout";
import type {
  Project,
  ProjectMember,
  Tag,
  Task,
  ViewMode,
} from "@/lib/schedule/types";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type ScheduleBoardProps = {
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
  tags: Tag[];
};

const COLUMN_WIDTH = 72;

/** undefined=닫힘, null=신규, string=수정 대상 id */
type EditingTarget = string | null | undefined;

export default function ScheduleBoard({
  project,
  tasks,
  members,
  tags,
}: ScheduleBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const saved = loadBoardPreferences(project.id);

  const [viewMode, setViewMode] = useState<ViewMode>(saved.viewMode ?? "week");
  const [dayColumnWidth, setDayColumnWidth] = useState(
    saved.dayColumnWidth ?? DEFAULT_DAY_COLUMN_WIDTH,
  );
  const [weekColumnWidth, setWeekColumnWidth] = useState(
    saved.weekColumnWidth ?? DEFAULT_WEEK_COLUMN_WIDTH,
  );
  const [monthColumnWidth, setMonthColumnWidth] = useState(
    saved.monthColumnWidth ?? DEFAULT_MONTH_COLUMN_WIDTH,
  );
  const [sortKey, setSortKey] = useState<SortKey>(
    resolveSortKey(saved.sortKey),
  );
  const [visibleColumns, setVisibleColumns] = useState({
    ...DEFAULT_VISIBLE_COLUMNS,
    ...(saved.visibleColumns ?? {}),
  });
  const [filters, setFilters] = useState<BoardFilters>(
    saved.filters ?? DEFAULT_FILTERS,
  );
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(undefined);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  /** 일 뷰: 헤더로 연 이른/야근 확장 (날짜 키) */
  const [daySessionExpands, setDaySessionExpands] = useState<
    Record<string, DaySessionExpand>
  >({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayWidthRef = useRef(dayColumnWidth);
  dayWidthRef.current = dayColumnWidth;
  const weekWidthRef = useRef(weekColumnWidth);
  weekWidthRef.current = weekColumnWidth;
  const monthWidthRef = useRef(monthColumnWidth);
  monthWidthRef.current = monthColumnWidth;
  /** 줌 후 커서 아래 지점을 유지하기 위한 scrollLeft */
  const pendingScrollLeftRef = useRef<number | null>(null);

  const editingTask: Task | null | undefined =
    editingTarget === undefined
      ? undefined
      : editingTarget === null
        ? null
        : tasks.find((t) => t.id === editingTarget);

  const persist = useCallback(
    (
      next: Partial<{
        viewMode: ViewMode;
        sortKey: SortKey;
        visibleColumns: Record<ColumnKey, boolean>;
        filters: BoardFilters;
        dayColumnWidth: number;
        weekColumnWidth: number;
        monthColumnWidth: number;
      }>,
    ) => {
      saveBoardPreferences(project.id, {
        viewMode: next.viewMode ?? viewMode,
        sortKey: next.sortKey ?? sortKey,
        visibleColumns: next.visibleColumns ?? visibleColumns,
        filters: next.filters ?? filters,
        dayColumnWidth: next.dayColumnWidth ?? dayColumnWidth,
        weekColumnWidth: next.weekColumnWidth ?? weekColumnWidth,
        monthColumnWidth: next.monthColumnWidth ?? monthColumnWidth,
      });
    },
    [
      project.id,
      viewMode,
      sortKey,
      visibleColumns,
      filters,
      dayColumnWidth,
      weekColumnWidth,
      monthColumnWidth,
    ],
  );

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

  const allWorkLogs = useMemo(
    () => tasks.flatMap((t) => t.workLogs),
    [tasks],
  );

  const dayLayouts = useMemo(() => {
    if (viewMode !== "day") return undefined;
    return buildDayColumnLayouts(
      columns,
      allWorkLogs,
      dayColumnWidth,
      project.workdayStartHour,
      project.workdayEndHour,
      daySessionExpands,
    );
  }, [
    viewMode,
    columns,
    allWorkLogs,
    dayColumnWidth,
    project.workdayStartHour,
    project.workdayEndHour,
    daySessionExpands,
  ]);

  const columnWidth =
    viewMode === "day"
      ? dayColumnWidth
      : viewMode === "week"
        ? weekColumnWidth
        : viewMode === "month"
          ? monthColumnWidth
          : COLUMN_WIDTH;
  const canReorder = sortKey === "sortOrder";
  const isZoomableView =
    viewMode === "day" || viewMode === "week" || viewMode === "month";

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

  const handleDropAt = (insertIndex: number) => {
    if (!draggingId || !canReorder) return;
    const movedId = draggingId;
    const from = visibleTasks.findIndex((t) => t.id === movedId);
    setDraggingId(null);
    setDropInsertIndex(null);
    if (from < 0 || insertIndex === from) return;

    const { beforeId, afterId } = neighborsAtInsert(
      visibleTasks,
      movedId,
      insertIndex,
    );

    startTransition(async () => {
      await reorderTaskAction({
        projectId: project.id,
        taskId: movedId,
        beforeId,
        afterId,
      });
      router.refresh();
    });
  };

  // 패시브 기본 리스너에서는 preventDefault가 무시되므로 직접 등록
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isZoomableView) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-timeline-zoom]")) return;

      e.preventDefault();
      const prevWidth =
        viewMode === "day"
          ? dayWidthRef.current
          : viewMode === "week"
            ? weekWidthRef.current
            : monthWidthRef.current;
      const step =
        viewMode === "day"
          ? DAY_COLUMN_WIDTH_STEP
          : viewMode === "week"
            ? WEEK_COLUMN_WIDTH_STEP
            : MONTH_COLUMN_WIDTH_STEP;
      const delta = e.deltaY > 0 ? -step : step;
      const nextWidth =
        viewMode === "day"
          ? clampDayColumnWidth(prevWidth + delta)
          : viewMode === "week"
            ? clampWeekColumnWidth(prevWidth + delta)
            : clampMonthColumnWidth(prevWidth + delta);
      if (nextWidth === prevWidth) return;

      // 커서 아래 타임라인 지점이 줌 후에도 같은 화면에 남도록 scrollLeft 계산
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const contentX = el.scrollLeft + mouseX;
      const firstTimeline = el.querySelector(
        "[data-timeline-zoom]",
      ) as HTMLElement | null;
      const timelineStart =
        firstTimeline != null
          ? el.scrollLeft +
            (firstTimeline.getBoundingClientRect().left - rect.left)
          : 0;
      const timelineX = contentX - timelineStart;
      const scale = nextWidth / prevWidth;
      pendingScrollLeftRef.current =
        timelineStart + timelineX * scale - mouseX;

      if (viewMode === "day") {
        dayWidthRef.current = nextWidth;
        setDayColumnWidth(nextWidth);
        persist({ dayColumnWidth: nextWidth });
      } else if (viewMode === "week") {
        weekWidthRef.current = nextWidth;
        setWeekColumnWidth(nextWidth);
        persist({ weekColumnWidth: nextWidth });
      } else {
        monthWidthRef.current = nextWidth;
        setMonthColumnWidth(nextWidth);
        persist({ monthColumnWidth: nextWidth });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewMode, isZoomableView, persist]);

  // DOM 너비 반영 직후 커서 중심 스크롤 적용
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const nextScroll = pendingScrollLeftRef.current;
    if (!el || nextScroll == null) return;
    pendingScrollLeftRef.current = null;
    el.scrollLeft = nextScroll;
  }, [dayColumnWidth, weekColumnWidth, monthColumnWidth, dayLayouts]);

  const patchDayExpand = useCallback(
    (date: string, patch: Partial<DaySessionExpand>) => {
      setDaySessionExpands((prev) => {
        const current = prev[date] ?? { early: false, late: false };
        const next = { ...current, ...patch };
        if (!next.early && !next.late) {
          const { [date]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [date]: next };
      });
    },
    [],
  );

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

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded border border-zinc-300 dark:border-zinc-700"
      >
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
              <TimelineHeader
                columns={columns}
                columnWidth={columnWidth}
                viewMode={viewMode}
                dayLayouts={dayLayouts}
                sessionExpands={daySessionExpands}
                onExpandEarly={(date) =>
                  patchDayExpand(date, { early: true })
                }
                onExpandLate={(date) => patchDayExpand(date, { late: true })}
                onCollapseEarly={(date) =>
                  patchDayExpand(date, { early: false })
                }
                onCollapseLate={(date) =>
                  patchDayExpand(date, { late: false })
                }
              />
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
              visibleTasks.map((task, index) => (
                <tr
                  key={task.id}
                  onDragOver={
                    canReorder && draggingId
                      ? (e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const placeBefore =
                            e.clientY < rect.top + rect.height / 2;
                          setDropInsertIndex(
                            toInsertIndex(
                              visibleTasks,
                              draggingId,
                              index,
                              placeBefore,
                            ),
                          );
                        }
                      : undefined
                  }
                  onDrop={
                    canReorder && draggingId
                      ? (e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const placeBefore =
                            e.clientY < rect.top + rect.height / 2;
                          handleDropAt(
                            toInsertIndex(
                              visibleTasks,
                              draggingId,
                              index,
                              placeBefore,
                            ),
                          );
                        }
                      : undefined
                  }
                  className={
                    draggingId === task.id ? "opacity-50" : undefined
                  }
                >
                  <TaskMetaCells
                    task={task}
                    projectId={project.id}
                    members={members}
                    visibleColumns={visibleColumns}
                    allTasks={tasks}
                    onEdit={(t) => setEditingTarget(t.id)}
                    reorderEnabled={canReorder}
                    showDropIndicatorAbove={showIndicatorAbove(
                      visibleTasks,
                      draggingId,
                      dropInsertIndex,
                      index,
                    )}
                    showDropIndicatorBelow={showIndicatorBelow(
                      visibleTasks,
                      draggingId,
                      dropInsertIndex,
                      index,
                    )}
                    onDragHandleStart={() => setDraggingId(task.id)}
                    onDragHandleEnd={() => {
                      setDraggingId(null);
                      setDropInsertIndex(null);
                    }}
                  />
                  <TimelineCells
                    projectId={project.id}
                    task={task}
                    columns={columns}
                    columnWidth={columnWidth}
                    viewMode={viewMode}
                    dayLayouts={dayLayouts}
                    sessionExpands={daySessionExpands}
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
