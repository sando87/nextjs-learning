"use client";

import {
  reorderTaskAction,
  setTaskParentAction,
} from "@/app/schedule/actions";
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
  type BoardLayout,
  type ColumnKey,
  type SortKey,
} from "@/components/schedule/schedule-board-state";
import { generateTimelineColumns } from "@/lib/schedule/timeline-utils";
import {
  buildDayColumnLayouts,
  type DaySessionExpand,
} from "@/lib/schedule/day-workday-layout";
import {
  buildTaskTree,
  filterTasksKeepingAncestors,
  flattenVisible,
} from "@/lib/schedule/task-tree";
import type {
  Project,
  ProjectMember,
  Tag,
  Task,
  ViewMode,
} from "@/lib/schedule/types";
import { useHierarchyNestDrag } from "@/components/schedule/use-hierarchy-nest-drag";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
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

function matchesFilters(task: Task, filters: BoardFilters) {
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
}

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
  const [boardLayout, setBoardLayout] = useState<BoardLayout>(
    saved.boardLayout ?? "board",
  );
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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(saved.collapsedIds ?? []),
  );
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(undefined);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  /** 낙관적 parent 반영 (refresh 전 UI) */
  const [parentOverrides, setParentOverrides] = useState<
    Record<string, string | null>
  >({});
  /** 일 뷰: 헤더로 연 이른/야근 확장 (날짜 키) */
  const [daySessionExpands, setDaySessionExpands] = useState<
    Record<string, DaySessionExpand>
  >({});
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Board reorder용 — React dragend/drop 순서 이슈 대비 */
  const draggingIdRef = useRef<string | null>(null);
  const dropHandledRef = useRef(false);
  const dayWidthRef = useRef(dayColumnWidth);
  dayWidthRef.current = dayColumnWidth;
  const weekWidthRef = useRef(weekColumnWidth);
  weekWidthRef.current = weekColumnWidth;
  const monthWidthRef = useRef(monthColumnWidth);
  monthWidthRef.current = monthColumnWidth;
  /** 줌 후 커서 아래 지점을 유지하기 위한 scrollLeft */
  const pendingScrollLeftRef = useRef<number | null>(null);

  const isHierarchy = boardLayout === "hierarchy";

  const tasksWithParents = useMemo(() => {
    if (Object.keys(parentOverrides).length === 0) return tasks;
    return tasks.map((t) =>
      Object.prototype.hasOwnProperty.call(parentOverrides, t.id)
        ? { ...t, parentId: parentOverrides[t.id]! }
        : t,
    );
  }, [tasks, parentOverrides]);

  // props tasks가 갱신되면 낙관적 override 해제
  useEffect(() => {
    setParentOverrides({});
  }, [tasks]);

  const editingTask: Task | null | undefined =
    editingTarget === undefined
      ? undefined
      : editingTarget === null
        ? null
        : tasksWithParents.find((t) => t.id === editingTarget);

  const persist = useCallback(
    (
      next: Partial<{
        viewMode: ViewMode;
        boardLayout: BoardLayout;
        sortKey: SortKey;
        visibleColumns: Record<ColumnKey, boolean>;
        filters: BoardFilters;
        dayColumnWidth: number;
        weekColumnWidth: number;
        monthColumnWidth: number;
        collapsedIds: string[];
      }>,
    ) => {
      saveBoardPreferences(project.id, {
        viewMode: next.viewMode ?? viewMode,
        boardLayout: next.boardLayout ?? boardLayout,
        sortKey: next.sortKey ?? sortKey,
        visibleColumns: next.visibleColumns ?? visibleColumns,
        filters: next.filters ?? filters,
        dayColumnWidth: next.dayColumnWidth ?? dayColumnWidth,
        weekColumnWidth: next.weekColumnWidth ?? weekColumnWidth,
        monthColumnWidth: next.monthColumnWidth ?? monthColumnWidth,
        collapsedIds: next.collapsedIds ?? [...collapsedIds],
      });
    },
    [
      project.id,
      viewMode,
      boardLayout,
      sortKey,
      visibleColumns,
      filters,
      dayColumnWidth,
      weekColumnWidth,
      monthColumnWidth,
      collapsedIds,
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
  const canReorder = !isHierarchy && sortKey === "sortOrder";
  const isZoomableView =
    viewMode === "day" || viewMode === "week" || viewMode === "month";

  const boardVisibleTasks = useMemo(
    () => sortTasks(applyFilters(tasks, filters), sortKey),
    [tasks, filters, sortKey],
  );

  const hierarchyRows = useMemo(() => {
    const filtered = filterTasksKeepingAncestors(tasksWithParents, (t) =>
      matchesFilters(t, filters),
    );
    const tree = buildTaskTree(filtered);
    return flattenVisible(tree, collapsedIds);
  }, [tasksWithParents, filters, collapsedIds]);

  const visibleTasks = isHierarchy
    ? hierarchyRows.map((r) => r.task)
    : boardVisibleTasks;

  const metaHeaders: { key: ColumnKey | "title"; label: string }[] = [
    { key: "title", label: "WorkUnit" },
    ...(Object.keys(COLUMN_LABELS) as ColumnKey[])
      .filter((k) => visibleColumns[k])
      .map((k) => ({ key: k, label: COLUMN_LABELS[k] })),
  ];

  const clearBoardDragState = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropInsertIndex(null);
  };

  const beginBoardDrag = (taskId: string) => {
    dropHandledRef.current = false;
    draggingIdRef.current = taskId;
    setDraggingId(taskId);
  };

  /** dragend가 drop보다 먼저 와도 drop이 id를 읽을 수 있게 다음 틱에 정리 */
  const endBoardDrag = () => {
    window.setTimeout(() => {
      if (dropHandledRef.current) {
        dropHandledRef.current = false;
        return;
      }
      clearBoardDragState();
    }, 0);
  };

  const resolveMovedId = (e: DragEvent) => {
    const fromData = e.dataTransfer.getData("text/plain");
    return fromData || draggingIdRef.current;
  };

  const handleBoardDropAt = (e: DragEvent, insertIndex: number) => {
    if (!canReorder) return;
    const movedId = resolveMovedId(e);
    if (!movedId) return;
    dropHandledRef.current = true;
    const from = boardVisibleTasks.findIndex((t) => t.id === movedId);
    clearBoardDragState();
    if (from < 0 || insertIndex === from) return;

    const { beforeId, afterId } = neighborsAtInsert(
      boardVisibleTasks,
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

  const applyNest = useCallback(
    (taskId: string, parentId: string | null) => {
      setParentOverrides((prev) => ({ ...prev, [taskId]: parentId }));
      startTransition(async () => {
        try {
          await setTaskParentAction({
            projectId: project.id,
            taskId,
            parentId,
          });
          router.refresh();
        } catch (err) {
          setParentOverrides((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
          const message =
            err instanceof Error ? err.message : "상위 업무 변경에 실패했습니다";
          window.alert(message);
        }
      });
    },
    [project.id, router],
  );

  const {
    draggingId: nestDraggingId,
    dropTarget: nestDropTarget,
    onTitlePointerDown,
  } = useHierarchyNestDrag({
    enabled: isHierarchy,
    tasks: tasksWithParents,
    chartRef: scrollRef,
    onNest: applyNest,
  });

  const toggleCollapse = (taskId: string) => {
    const next = new Set(collapsedIds);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setCollapsedIds(next);
    persist({ collapsedIds: [...next] });
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
        boardLayout={boardLayout}
        sortKey={sortKey}
        visibleColumns={visibleColumns}
        filters={filters}
        members={members}
        tags={tags}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          persist({ viewMode: mode });
        }}
        onBoardLayoutChange={(layout) => {
          setBoardLayout(layout);
          clearBoardDragState();
          persist({ boardLayout: layout });
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
        data-schedule-chart
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
              visibleTasks.map((task, index) => {
                const rowMeta = isHierarchy
                  ? hierarchyRows[index]
                  : undefined;
                const depth = rowMeta?.depth ?? 0;
                const hasChildren = rowMeta?.hasChildren ?? false;
                const nestHighlight =
                  nestDropTarget?.kind === "task" &&
                  nestDropTarget.taskId === task.id;

                return (
                  <tr
                    key={task.id}
                    data-task-id={task.id}
                    onDragOver={
                      canReorder
                        ? (e) => {
                            if (!draggingIdRef.current) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const placeBefore =
                              e.clientY < rect.top + rect.height / 2;
                            setDropInsertIndex(
                              toInsertIndex(
                                boardVisibleTasks,
                                draggingIdRef.current,
                                index,
                                placeBefore,
                              ),
                            );
                          }
                        : undefined
                    }
                    onDrop={
                      canReorder
                        ? (e) => {
                            e.preventDefault();
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const placeBefore =
                              e.clientY < rect.top + rect.height / 2;
                            const movedId = resolveMovedId(e);
                            handleBoardDropAt(
                              e,
                              toInsertIndex(
                                boardVisibleTasks,
                                movedId,
                                index,
                                placeBefore,
                              ),
                            );
                          }
                        : undefined
                    }
                    className={
                      nestDraggingId === task.id || draggingId === task.id
                        ? "opacity-50"
                        : undefined
                    }
                  >
                    <TaskMetaCells
                      task={task}
                      projectId={project.id}
                      members={members}
                      visibleColumns={visibleColumns}
                      onEdit={(t) => setEditingTarget(t.id)}
                      dragMode={
                        isHierarchy
                          ? "nest"
                          : canReorder
                            ? "reorder"
                            : "none"
                      }
                      dragTitle={
                        isHierarchy
                          ? "제목을 드래그하여 상위 업무에 할당"
                          : "드래그하여 순서 변경"
                      }
                      depth={isHierarchy ? depth : 0}
                      hasChildren={isHierarchy ? hasChildren : false}
                      collapsed={collapsedIds.has(task.id)}
                      onToggleCollapse={
                        isHierarchy && hasChildren
                          ? () => toggleCollapse(task.id)
                          : undefined
                      }
                      showDropIndicatorAbove={
                        canReorder
                          ? showIndicatorAbove(
                              boardVisibleTasks,
                              draggingId,
                              dropInsertIndex,
                              index,
                            )
                          : false
                      }
                      showDropIndicatorBelow={
                        canReorder
                          ? showIndicatorBelow(
                              boardVisibleTasks,
                              draggingId,
                              dropInsertIndex,
                              index,
                            )
                          : false
                      }
                      nestHighlight={nestHighlight}
                      onDragHandleStart={() => beginBoardDrag(task.id)}
                      onDragHandleEnd={endBoardDrag}
                      onNestPointerDown={(e) =>
                        onTitlePointerDown(task.id, e)
                      }
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
                );
              })
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
          task={editingTask}
          onClose={() => setEditingTarget(undefined)}
        />
      ) : null}
    </div>
  );
}
