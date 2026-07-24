"use client";

import {
  reorderTaskAction,
  setTaskParentAction,
} from "@/app/schedule/actions";
import ReplayControls from "@/components/schedule/ReplayControls";
import ReplayPlayhead from "@/components/schedule/ReplayPlayhead";
import ScheduleToolbar from "@/components/schedule/ScheduleToolbar";
import TaskForm from "@/components/schedule/TaskForm";
import TaskMetaCells from "@/components/schedule/TaskMetaCells";
import TimelineCells from "@/components/schedule/TimelineCells";
import TimelineHeader from "@/components/schedule/TimelineHeader";
import { WorkLogSelectionProvider } from "@/components/schedule/work-log-selection-context";
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
  getLastVisibleMetaKey,
  getMetaStickyLefts,
  loadBoardPreferences,
  META_COLUMN_WIDTHS,
  MONTH_COLUMN_WIDTH_STEP,
  saveBoardPreferences,
  WEEK_COLUMN_WIDTH_STEP,
  type BoardFilters,
  type BoardLayout,
  type ColumnKey,
  type MetaColumnKey,
  type SortKey,
} from "@/components/schedule/schedule-board-state";
import { useScheduleReplay } from "@/components/schedule/use-schedule-replay";
import {
  collectScheduleDateBounds,
  generateTimelineColumns,
  shiftDateByColumns,
  TIMELINE_EXTEND_COLUMNS,
  TIMELINE_INITIAL_PAST_PADDING,
} from "@/lib/schedule/timeline-utils";
import {
  buildDayColumnLayouts,
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
import {
  filterTasksByChartWindow,
} from "@/lib/schedule/done-task-visibility";
import {
  localTodayStr,
  scrollLeftForTodayDefault,
  todayLeftInTimeline,
} from "@/lib/schedule/timeline-today";
import { formatRelativeColumnLabel } from "@/lib/schedule/relative-timeline-labels";
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
  const [useRelativeDates] = useState(saved.useRelativeDates ?? false);
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(undefined);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  /** 낙관적 parent 반영 (refresh 전 UI) */
  const [parentOverrides, setParentOverrides] = useState<
    Record<string, string | null>
  >({});
  /** 전체시간 on: 0–24 / off: 프로젝트 근무시간대 (기본 off) */
  const [showFullDayHours, setShowFullDayHours] = useState(false);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [viewModeBeforeReplay, setViewModeBeforeReplay] =
    useState<ViewMode | null>(null);
  const [replaySessionId, setReplaySessionId] = useState(0);
  const [measuredPlayheadBase, setMeasuredPlayheadBase] = useState(0);
  /** 타임라인 왼쪽(과거)으로 추가로 연 칸 수 */
  const [timelinePastExtra, setTimelinePastExtra] = useState(0);
  /** 타임라인 오른쪽(미래)으로 추가로 연 칸 수 */
  const [timelineFutureExtra, setTimelineFutureExtra] = useState(0);
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
  /** 왼쪽에 컬럼 추가 후 scroll 위치 보정 */
  const pendingPastScrollPreserveRef = useRef<{
    prevScrollWidth: number;
    prevScrollLeft: number;
  } | null>(null);
  const didInitialTodayScrollRef = useRef(false);
  const today = localTodayStr();

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
        useRelativeDates: boolean;
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
        useRelativeDates: next.useRelativeDates ?? useRelativeDates,
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
      useRelativeDates,
    ],
  );

  const columns = useMemo(() => {
    // 일 뷰: 총 21칸, 오늘 기준 왼쪽 7칸 + 나머지(오늘 포함) 오른쪽
    if (viewMode === "day") {
      const pastCols = 7 + timelinePastExtra;
      const totalCols = 21 + timelinePastExtra + timelineFutureExtra;
      const rangeStart = shiftDateByColumns(today, "day", -pastCols);
      const rangeEnd = shiftDateByColumns(rangeStart, "day", totalCols - 1);
      return generateTimelineColumns("day", rangeStart, rangeEnd, totalCols);
    }

    // 주 뷰: 총 14칸, 오늘 기준 왼쪽 2칸 + 나머지(오늘 포함) 오른쪽
    if (viewMode === "week") {
      const pastCols = 2 + timelinePastExtra;
      const totalCols = 14 + timelinePastExtra + timelineFutureExtra;
      const rangeStart = shiftDateByColumns(today, "week", -pastCols);
      const rangeEnd = shiftDateByColumns(
        rangeStart,
        "week",
        totalCols - 1,
      );
      return generateTimelineColumns("week", rangeStart, rangeEnd, totalCols);
    }

    // 월 뷰: 업무 범위 + 최소 14칸
    const workLogStarts = tasks.flatMap((t) =>
      t.workLogs.map((log) => log.startedAt),
    );
    const workLogEnds = tasks.flatMap((t) =>
      t.workLogs.map((log) => log.endedAt),
    );
    const bounds = collectScheduleDateBounds(
      tasks.map((t) => t.startDate),
      tasks.map((t) => t.endDate),
      workLogStarts,
      workLogEnds,
      today,
    );
    const pastPad =
      TIMELINE_INITIAL_PAST_PADDING.month + timelinePastExtra;
    const rangeStart = shiftDateByColumns(
      bounds.startDate,
      "month",
      -pastPad,
    );
    const rangeEnd = shiftDateByColumns(
      bounds.endDate,
      "month",
      timelineFutureExtra,
    );
    return generateTimelineColumns("month", rangeStart, rangeEnd, 14);
  }, [viewMode, tasks, today, timelinePastExtra, timelineFutureExtra]);

  // 설정에서 켠 경우 헤더 라벨만 프로젝트 시작일 기준 상대날짜로 교체
  const headerColumns = useMemo(() => {
    if (!useRelativeDates) return columns;
    return columns.map((col) => ({
      ...col,
      label: formatRelativeColumnLabel(
        viewMode,
        col.startDate,
        project.startDate,
      ),
    }));
  }, [columns, useRelativeDates, viewMode, project.startDate]);

  const effectiveColumnWidth =
    viewMode === "day"
      ? dayColumnWidth
      : viewMode === "week"
        ? weekColumnWidth
        : viewMode === "month"
          ? monthColumnWidth
          : COLUMN_WIDTH;

  const replay = useScheduleReplay({
    enabled: isReplayMode && viewMode === "week",
    projectId: project.id,
    columns,
    tasks: tasksWithParents,
    columnWidth: effectiveColumnWidth,
    sessionId: replaySessionId,
  });

  const displayTasks = isReplayMode ? replay.replayedTasks : tasksWithParents;

  /** 활성 상태는 전부, 완료는 차트 윈도우 날짜(updated_at) 안만 */
  const loadedTasks = useMemo(
    () => filterTasksByChartWindow(displayTasks, columns),
    [displayTasks, columns],
  );

  const allWorkLogs = useMemo(
    () => loadedTasks.flatMap((t) => t.workLogs),
    [loadedTasks],
  );

  const dayLayouts = useMemo(() => {
    if (viewMode !== "day") return undefined;
    return buildDayColumnLayouts(
      columns,
      allWorkLogs,
      dayColumnWidth,
      project.workdayStartHour,
      project.workdayEndHour,
      showFullDayHours,
    );
  }, [
    viewMode,
    columns,
    allWorkLogs,
    dayColumnWidth,
    project.workdayStartHour,
    project.workdayEndHour,
    showFullDayHours,
  ]);

  const dayHoursOptions = useMemo(
    () => ({
      workdayStartHour: project.workdayStartHour,
      workdayEndHour: project.workdayEndHour,
      showFullDayHours,
    }),
    [project.workdayStartHour, project.workdayEndHour, showFullDayHours],
  );

  const columnWidth = effectiveColumnWidth;
  const canReorder = !isReplayMode && !isHierarchy && sortKey === "sortOrder";
  const isZoomableView =
    viewMode === "day" || viewMode === "week" || viewMode === "month";

  const boardVisibleTasks = useMemo(
    () => sortTasks(applyFilters(loadedTasks, filters), sortKey),
    [loadedTasks, filters, sortKey],
  );

  const hierarchyRows = useMemo(() => {
    const filtered = filterTasksKeepingAncestors(loadedTasks, (t) =>
      matchesFilters(t, filters),
    );
    const tree = buildTaskTree(filtered);
    return flattenVisible(tree, collapsedIds);
  }, [loadedTasks, filters, collapsedIds]);

  const visibleTasks = isHierarchy
    ? hierarchyRows.map((r) => r.task)
    : boardVisibleTasks;

  const metaHeaders: { key: MetaColumnKey; label: string }[] = [
    { key: "title", label: "WorkUnit" },
    ...(Object.keys(COLUMN_LABELS) as ColumnKey[])
      .filter((k) => visibleColumns[k])
      .map((k) => ({ key: k, label: COLUMN_LABELS[k] })),
  ];
  const metaStickyLefts = getMetaStickyLefts(visibleColumns);
  const lastMetaKey = getLastVisibleMetaKey(visibleColumns);

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
    enabled: isHierarchy && !isReplayMode,
    tasks: loadedTasks,
    chartRef: scrollRef,
    onNest: applyNest,
  });

  // Replay 플레이헤드: 타임라인 셀 시작 위치 측정
  useLayoutEffect(() => {
    if (!isReplayMode) return;
    const root = scrollRef.current;
    if (!root) return;

    const measure = () => {
      const cell = root.querySelector<HTMLElement>("[data-timeline-zoom]");
      if (!cell) return;
      const rootRect = root.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      setMeasuredPlayheadBase(
        cellRect.left - rootRect.left + root.scrollLeft,
      );
    };

    measure();
    root.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      root.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [isReplayMode, columnWidth, visibleColumns, visibleTasks.length]);

  const playheadOffset = isReplayMode
    ? measuredPlayheadBase + replay.playheadLeftInTimeline
    : 0;

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

  // 왼쪽에 과거 컬럼 추가 후 스크롤 위치 유지
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pending = pendingPastScrollPreserveRef.current;
    if (!el || !pending) return;
    pendingPastScrollPreserveRef.current = null;
    el.scrollLeft =
      el.scrollWidth - pending.prevScrollWidth + pending.prevScrollLeft;
  }, [columns]);

  const scrollToTodayDefault = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const todayLeft = todayLeftInTimeline(
      columns,
      columnWidth,
      today,
      dayLayouts,
    );
    if (todayLeft == null) return;
    el.scrollLeft = scrollLeftForTodayDefault(el, todayLeft, viewMode);
  }, [columns, columnWidth, today, dayLayouts, viewMode]);

  const extendPastColumns = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      pendingPastScrollPreserveRef.current = {
        prevScrollWidth: el.scrollWidth,
        prevScrollLeft: el.scrollLeft,
      };
    }
    setTimelinePastExtra((prev) => prev + TIMELINE_EXTEND_COLUMNS);
  }, []);

  const extendFutureColumns = useCallback(() => {
    setTimelineFutureExtra((prev) => prev + TIMELINE_EXTEND_COLUMNS);
  }, []);

  // 첫 로딩·뷰 전환 시 오늘을 틀고정 우측 기준 위치로
  useLayoutEffect(() => {
    if (columns.length === 0) return;
    if (didInitialTodayScrollRef.current) return;
    scrollToTodayDefault();
    didInitialTodayScrollRef.current = true;
  }, [columns, dayLayouts, scrollToTodayDefault]);

  return (
    <WorkLogSelectionProvider>
    <div className="flex flex-col gap-4">
      <ScheduleToolbar
        viewMode={viewMode}
        boardLayout={boardLayout}
        sortKey={sortKey}
        visibleColumns={visibleColumns}
        filters={filters}
        members={members}
        tags={tags}
        isReplayMode={isReplayMode}
        showFullDayHours={showFullDayHours}
        onViewModeChange={(mode) => {
          if (isReplayMode) return;
          setViewMode(mode);
          setTimelinePastExtra(0);
          setTimelineFutureExtra(0);
          didInitialTodayScrollRef.current = false;
          persist({ viewMode: mode });
        }}
        onBoardLayoutChange={(layout) => {
          if (isReplayMode) return;
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
        onScrollToToday={scrollToTodayDefault}
        onExtendPast={extendPastColumns}
        onExtendFuture={extendFutureColumns}
        onShowFullDayHoursChange={setShowFullDayHours}
        onReplayModeChange={(enabled) => {
          if (enabled) {
            setViewModeBeforeReplay(viewMode);
            setViewMode("week");
            persist({ viewMode: "week" });
            setReplaySessionId((id) => id + 1);
            setIsReplayMode(true);
            clearBoardDragState();
            return;
          }
          setIsReplayMode(false);
          if (viewModeBeforeReplay) {
            setViewMode(viewModeBeforeReplay);
            persist({ viewMode: viewModeBeforeReplay });
            setViewModeBeforeReplay(null);
          }
        }}
      />

      {isReplayMode ? (
        <>
          <ReplayControls
            playing={replay.clock.playing}
            playheadLabel={replay.playheadLabel}
            stepUnit={replay.stepUnit}
            onTogglePlay={replay.clock.toggle}
            onStepBack={replay.stepBack}
            onStepForward={replay.stepForward}
            onStepUnitChange={replay.setStepUnit}
          />
          {replay.loading ? (
            <p className="text-xs text-zinc-500">변경 이력 불러오는 중…</p>
          ) : null}
        </>
      ) : null}

      <div
        ref={scrollRef}
        data-schedule-chart
        className="relative overflow-x-auto rounded border border-zinc-300 dark:border-zinc-700"
      >
        <ReplayPlayhead left={playheadOffset} visible={isReplayMode} />
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {metaHeaders.map((col) => {
                const width = META_COLUMN_WIDTHS[col.key];
                const isEdge = col.key === lastMetaKey;
                return (
                  <th
                    key={col.key}
                    className={`sticky z-20 relative border border-zinc-300 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900 before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:bg-zinc-50 dark:before:bg-zinc-900 ${
                      isEdge
                        ? "after:pointer-events-none after:absolute after:inset-y-0 after:-right-px after:z-[1] after:w-px after:bg-zinc-400/90 after:content-[''] dark:after:bg-zinc-500 shadow-[4px_0_10px_-6px_rgba(0,0,0,0.28)] dark:shadow-[4px_0_10px_-6px_rgba(0,0,0,0.55)]"
                        : ""
                    }`}
                    style={{
                      left: metaStickyLefts[col.key] ?? 0,
                      width,
                      minWidth: width,
                      maxWidth: width,
                    }}
                  >
                    {col.label}
                  </th>
                );
              })}
              <TimelineHeader
                columns={headerColumns}
                columnWidth={columnWidth}
                viewMode={viewMode}
                today={today}
                dayLayouts={dayLayouts}
                onSeekClick={
                  isReplayMode
                    ? (clientX) => {
                        const root = scrollRef.current;
                        if (!root) return;
                        const rootRect = root.getBoundingClientRect();
                        const leftInTimeline =
                          clientX -
                          rootRect.left +
                          root.scrollLeft -
                          measuredPlayheadBase;
                        replay.seekByTimelineLeft(leftInTimeline);
                      }
                    : undefined
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
                        : replay.highlightTaskId === task.id
                          ? "bg-rose-50/80 dark:bg-rose-950/30"
                          : undefined
                    }
                  >
                    <TaskMetaCells
                      task={task}
                      projectId={project.id}
                      members={members}
                      visibleColumns={visibleColumns}
                      onEdit={
                        isReplayMode ? () => undefined : (t) => setEditingTarget(t.id)
                      }
                      dragMode={
                        isReplayMode
                          ? "none"
                          : isHierarchy
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
                      readOnly={isReplayMode}
                    />
                    <TimelineCells
                      projectId={project.id}
                      task={task}
                      columns={columns}
                      columnWidth={columnWidth}
                      viewMode={viewMode}
                      today={today}
                      dayLayouts={dayLayouts}
                      dayHoursOptions={dayHoursOptions}
                      readOnly={isReplayMode}
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
                {isReplayMode ? (
                  <span>Replay 모드에서는 업무를 추가할 수 없습니다</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTarget(null)}
                    className="hover:underline"
                  >
                    [Add New Work]
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {editingTask !== undefined && !isReplayMode ? (
        <TaskForm
          projectId={project.id}
          members={members}
          tags={tags}
          task={editingTask}
          onClose={() => setEditingTarget(undefined)}
        />
      ) : null}
    </div>
    </WorkLogSelectionProvider>
  );
}
