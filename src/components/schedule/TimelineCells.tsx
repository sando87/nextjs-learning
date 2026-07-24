"use client";

import { deleteWorkLogAction, updateWorkLogAction } from "@/app/schedule/actions";
import PlanGanttBar from "@/components/schedule/PlanGanttBar";
import { usePlanDrag } from "@/components/schedule/use-plan-drag";
import { useWorkLogDrag } from "@/components/schedule/use-work-log-drag";
import WorkLogGanttBar from "@/components/schedule/WorkLogGanttBar";
import type { DayColumnLayout } from "@/lib/schedule/day-workday-layout";
import { totalDayLayoutsWidth } from "@/lib/schedule/day-workday-layout";
import { getPlanBarPlacement } from "@/lib/schedule/plan-bar-placements";
import {
  type DayHoursOptions,
  getWorkLogBarSegments,
  previewToSegment,
} from "@/lib/schedule/work-log-bar-placements";
import {
  columnContainsDate,
  todayBandInColumn,
} from "@/lib/schedule/timeline-today";
import {
  getDayHourTickStep,
  getDayHourTicksVisible,
  getMonthTickMode,
  getMonthTicks,
  getWeekDayTickVisible,
} from "@/lib/schedule/timeline-utils";
import type { Task, TimelineColumn, ViewMode } from "@/lib/schedule/types";
import { useWorkLogSelection } from "@/components/schedule/work-log-selection-context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

type TimelineCellsProps = {
  projectId: string;
  task: Task;
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
  /** YYYY-MM-DD — 해당 일 포함 열 배경 강조 */
  today: string;
  dayLayouts?: DayColumnLayout[];
  dayHoursOptions?: DayHoursOptions;
  /** Replay 등: 드래그/생성 비활성 */
  readOnly?: boolean;
};

const TODAY_COL_BG = "bg-rose-50/70 dark:bg-rose-950/35";
const TODAY_BAND_BG = "bg-rose-200/80 dark:bg-rose-800/45";

function DayColumnGuides({
  startHour,
  endHour,
  columnWidth,
}: {
  startHour: number;
  endHour: number;
  columnWidth: number;
}) {
  const span = Math.max(1, endHour - startHour);
  const step = getDayHourTickStep(columnWidth);
  const hours: number[] = [];
  for (let h = startHour + step; h < endHour; h += step) {
    hours.push(h);
  }

  return (
    <>
      {hours.map((hour) => (
        <div
          key={hour}
          className="pointer-events-none absolute inset-y-0 w-px bg-zinc-200 dark:bg-zinc-700"
          style={{ left: `${((hour - startHour) / span) * 100}%` }}
        />
      ))}
    </>
  );
}

function WeekColumnGuides() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((dayOffset) => (
        <div
          key={dayOffset}
          className="pointer-events-none absolute inset-y-0 w-px bg-zinc-200 dark:bg-zinc-700"
          style={{ left: `${(dayOffset / 7) * 100}%` }}
        />
      ))}
    </>
  );
}

function MonthColumnGuides({
  startDate,
  endDate,
  mode,
}: {
  startDate: string;
  endDate: string;
  mode: "week" | "day";
}) {
  const ticks = getMonthTicks(startDate, endDate, mode).filter(
    (t) => t.frac > 0,
  );

  return (
    <>
      {ticks.map((tick) => (
        <div
          key={tick.key}
          className="pointer-events-none absolute inset-y-0 w-px bg-zinc-200 dark:bg-zinc-700"
          style={{ left: `${tick.frac * 100}%` }}
        />
      ))}
    </>
  );
}

export default function TimelineCells({
  projectId,
  task,
  columns,
  columnWidth,
  viewMode,
  today,
  dayLayouts,
  dayHoursOptions,
  readOnly = false,
}: TimelineCellsProps) {
  const isDayView = viewMode === "day";
  const totalWidth =
    isDayView && dayLayouts
      ? totalDayLayoutsWidth(dayLayouts)
      : columns.length * columnWidth;
  const router = useRouter();
  const isWorkLogEditable = !readOnly && viewMode === "day";
  const isMemoView = isWorkLogEditable;
  const isPlanEditable = !readOnly && (viewMode === "week" || viewMode === "month");
  const showPlan = viewMode === "week" || viewMode === "month";
  const {
    selectedWorkLogId,
    editingNoteId,
    shouldDiscardNoteEdit,
    select: selectWorkLog,
    clear: clearWorkLogSelectionGlobal,
    startEdit,
    cancelEdit,
    endEditIf,
  } = useWorkLogSelection();

  const ownsSelection = useMemo(
    () => task.workLogs.some((l) => l.id === selectedWorkLogId),
    [selectedWorkLogId, task.workLogs],
  );

  const {
    containerRef: workLogContainerRef,
    preview: workLogPreview,
    pending: workLogPending,
    draggingWorkLogId,
    startCreate: startWorkLogCreate,
    startBarPointerDown: startWorkLogBarPointerDown,
    cancelDrag: cancelWorkLogDrag,
  } = useWorkLogDrag({
    projectId,
    taskId: task.id,
    columns,
    columnWidth,
    viewMode,
    workLogs: task.workLogs,
    dayLayouts: isDayView ? dayLayouts : undefined,
    onBarClick: isMemoView
      ? (workLogId) => {
          startEdit(workLogId);
        }
      : undefined,
  });

  // 다른 업무 바 선택 시 이 행의 드래그/생성 중단
  useEffect(() => {
    if (!ownsSelection) cancelWorkLogDrag();
  }, [cancelWorkLogDrag, ownsSelection]);

  const clearWorkLogSelection = useCallback(() => {
    clearWorkLogSelectionGlobal();
    cancelWorkLogDrag();
  }, [cancelWorkLogDrag, clearWorkLogSelectionGlobal]);

  const handleBarSelect = useCallback(
    (workLogId: string) => {
      cancelWorkLogDrag();
      selectWorkLog(workLogId);
    },
    [cancelWorkLogDrag, selectWorkLog],
  );

  const handleEditNote = useCallback(
    (workLogId: string) => {
      startEdit(workLogId);
    },
    [startEdit],
  );

  const handleCancelNote = useCallback(() => {
    cancelEdit();
  }, [cancelEdit]);

  const handleCommitNote = useCallback(
    async (workLogId: string, note: string) => {
      if (shouldDiscardNoteEdit()) return;
      if (!endEditIf(workLogId)) return;

      const log = task.workLogs.find((l) => l.id === workLogId);
      if (!log) return;
      const next = note.trim();
      const prev = (log.note ?? "").trim();
      if (next === prev) return;

      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("workLogId", workLogId);
      fd.set("startDate", log.startedAt.slice(0, 10));
      fd.set("endDate", log.endedAt.slice(0, 10));
      fd.set("startHour", log.startedAt.slice(11, 13));
      fd.set("endHour", log.endedAt.slice(11, 13));
      fd.set("note", next);
      const result = await updateWorkLogAction(fd);
      if (!result.ok) console.error(result.error);
      router.refresh();
    },
    [endEditIf, projectId, router, shouldDiscardNoteEdit, task.workLogs],
  );

  // 바 바깥 클릭 시 선택·편집·드래그 해제 (선택 소유 행만)
  useEffect(() => {
    if (!ownsSelection || !isWorkLogEditable) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      if (target.closest(`[data-work-log-bar="${selectedWorkLogId}"]`)) return;
      if (target.closest("[data-work-log-note]")) return;
      // 같은 행 빈 곳은 container가 clear+생성대기 처리
      if (target.closest(`[data-task-timeline="${task.id}"]`)) return;
      clearWorkLogSelection();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [
    clearWorkLogSelection,
    isWorkLogEditable,
    ownsSelection,
    selectedWorkLogId,
    task.id,
  ]);

  // Delete로 선택 바 삭제 (선택 소유 행만)
  useEffect(() => {
    if (!ownsSelection || !isWorkLogEditable || editingNoteId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (!selectedWorkLogId) return;
      e.preventDefault();
      const workLogId = selectedWorkLogId;
      clearWorkLogSelection();
      void (async () => {
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("workLogId", workLogId);
        const result = await deleteWorkLogAction(fd);
        if (!result.ok) console.error(result.error);
        router.refresh();
      })();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearWorkLogSelection,
    editingNoteId,
    isWorkLogEditable,
    ownsSelection,
    projectId,
    router,
    selectedWorkLogId,
  ]);

  // 목록에서 사라진 선택 정리
  useEffect(() => {
    if (!selectedWorkLogId || !ownsSelection) return;
    if (!task.workLogs.some((l) => l.id === selectedWorkLogId)) {
      clearWorkLogSelection();
    }
  }, [
    clearWorkLogSelection,
    ownsSelection,
    selectedWorkLogId,
    task.workLogs,
  ]);

  const {
    containerRef: planContainerRef,
    previewPlacement: planPreviewPlacement,
    pending: planPending,
    dragging: planDragging,
    hasPlan,
    startCreate: startPlanCreate,
    startBarPointerDown: startPlanBarPointerDown,
  } = usePlanDrag({
    projectId,
    taskId: task.id,
    columns,
    columnWidth,
    startDate: task.startDate,
    endDate: task.endDate,
    enabled: isPlanEditable,
  });

  const setContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      (
        workLogContainerRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = el;
      (
        planContainerRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = el;
    },
    [workLogContainerRef, planContainerRef],
  );

  const pending = workLogPending || planPending;

  const workLogSegments = useMemo(
    () =>
      task.workLogs.flatMap((log) =>
        getWorkLogBarSegments(
          viewMode,
          log,
          columns,
          columnWidth,
          isDayView ? dayLayouts : undefined,
          dayHoursOptions,
        ),
      ),
    [
      task.workLogs,
      viewMode,
      columns,
      columnWidth,
      isDayView,
      dayLayouts,
      dayHoursOptions,
    ],
  );

  const planPlacement = useMemo(
    () =>
      showPlan
        ? getPlanBarPlacement(
            task.startDate,
            task.endDate,
            columns,
            columnWidth,
          )
        : null,
    [showPlan, task.startDate, task.endDate, columns, columnWidth],
  );

  const workLogPreviewSegment =
    isWorkLogEditable && workLogPreview
      ? previewToSegment(
          viewMode,
          workLogPreview.startSlot,
          workLogPreview.endExclusiveSlot,
          columnWidth,
          "__preview__",
          dayLayouts,
        )
      : null;

  const needsContainerRef = isWorkLogEditable || isPlanEditable;

  return (
    <td
      colSpan={columns.length}
      data-timeline-zoom
      data-task-timeline={task.id}
      className="relative border border-zinc-300 p-0 dark:border-zinc-700"
      style={{ width: totalWidth, minWidth: totalWidth, height: 36 }}
    >
      <div
        ref={needsContainerRef ? setContainerRef : undefined}
        className={`relative flex h-full select-none ${
          isWorkLogEditable || (isPlanEditable && !hasPlan)
            ? "cursor-crosshair"
            : ""
        }`}
        style={{ width: totalWidth }}
        onPointerDown={(e) => {
          if (pending || e.button !== 0) return;
          if (isWorkLogEditable) {
            // 선택/편집 해제 후, 드래그해야만 신규 생성 (클릭만으로는 생성 안 함)
            clearWorkLogSelection();
            startWorkLogCreate(e.clientX, e.clientY);
            return;
          }
          if (isPlanEditable && !hasPlan) {
            startPlanCreate(e.clientX);
          }
        }}
      >
        {columns.map((col, index) => {
          const layout = dayLayouts?.[index];
          const width = isDayView && layout ? layout.width : columnWidth;
          const showDayGuides =
            isDayView && layout && getDayHourTicksVisible(columnWidth);
          const monthMode =
            viewMode === "month" ? getMonthTickMode(columnWidth) : "none";
          const isTodayCol = columnContainsDate(col, today);
          const todayBand =
            isTodayCol && !isDayView ? todayBandInColumn(col, today) : null;
          const dayTodayBg = isDayView && isTodayCol;
          return (
            <div
              key={col.key}
              className={`relative h-full shrink-0 border-r border-zinc-300 last:border-r-0 dark:border-zinc-700 ${
                dayTodayBg ? TODAY_COL_BG : ""
              }`}
              style={{ width }}
            >
              {todayBand ? (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-y-0 ${TODAY_BAND_BG}`}
                  style={{
                    left: `${todayBand.leftFrac * 100}%`,
                    width: `${todayBand.widthFrac * 100}%`,
                  }}
                />
              ) : null}
              {showDayGuides && layout ? (
                <DayColumnGuides
                  startHour={layout.startHour}
                  endHour={layout.endHour}
                  columnWidth={width}
                />
              ) : viewMode === "week" && getWeekDayTickVisible(columnWidth) ? (
                <WeekColumnGuides />
              ) : monthMode !== "none" ? (
                <MonthColumnGuides
                  startDate={col.startDate}
                  endDate={col.endDate}
                  mode={monthMode}
                />
              ) : null}
            </div>
          );
        })}

        {showPlan && planPlacement && !planDragging ? (
          <PlanGanttBar
            left={planPlacement.left}
            width={planPlacement.width}
            title={`계획 ${task.startDate}–${task.endDate}`}
            interactive={isPlanEditable}
            disabled={pending}
            onBarPointerDown={
              isPlanEditable ? startPlanBarPointerDown : undefined
            }
          />
        ) : null}

        {showPlan && planPreviewPlacement ? (
          <PlanGanttBar
            left={planPreviewPlacement.left}
            width={planPreviewPlacement.width}
            title="계획 미리보기"
            isPreview
            disabled
            interactive={false}
          />
        ) : null}

        {workLogSegments.map((seg) => {
          if (draggingWorkLogId === seg.workLogId) return null;
          const log = task.workLogs.find((l) => l.id === seg.workLogId);
          if (!log) return null;
          const isSelected = selectedWorkLogId === seg.workLogId;
          const isEditingNote = editingNoteId === seg.workLogId;

          return (
            <WorkLogGanttBar
              key={seg.segmentKey}
              workLogId={seg.workLogId}
              status={task.status}
              left={seg.left}
              width={seg.width}
              note={log.note}
              selected={isSelected}
              editingNote={isEditingNote}
              interactive={isWorkLogEditable}
              disabled={pending}
              onSelect={isWorkLogEditable ? handleBarSelect : undefined}
              onEditNote={isMemoView ? handleEditNote : undefined}
              onCommitNote={isMemoView ? handleCommitNote : undefined}
              onCancelNote={isMemoView ? handleCancelNote : undefined}
              onBarPointerDown={
                isWorkLogEditable && isSelected && !isEditingNote
                  ? startWorkLogBarPointerDown
                  : undefined
              }
            />
          );
        })}

        {workLogPreviewSegment ? (
          <WorkLogGanttBar
            workLogId="__preview__"
            status={task.status}
            left={workLogPreviewSegment.left}
            width={workLogPreviewSegment.width}
            isPreview
            disabled
            interactive={false}
          />
        ) : null}
      </div>
    </td>
  );
}
