"use client";

import PlanGanttBar from "@/components/schedule/PlanGanttBar";
import { usePlanDrag } from "@/components/schedule/use-plan-drag";
import { useWorkLogDrag } from "@/components/schedule/use-work-log-drag";
import WorkLogGanttBar from "@/components/schedule/WorkLogGanttBar";
import WorkLogNotePopover from "@/components/schedule/WorkLogNotePopover";
import type { DayColumnLayout } from "@/lib/schedule/day-workday-layout";
import { totalDayLayoutsWidth } from "@/lib/schedule/day-workday-layout";
import { getPlanBarPlacement } from "@/lib/schedule/plan-bar-placements";
import {
  getWorkLogBarSegments,
  previewToSegment,
} from "@/lib/schedule/work-log-bar-placements";
import {
  getDayHourTickStep,
  getDayHourTicksVisible,
  getMonthTickMode,
  getMonthTicks,
  getWeekDayTickVisible,
} from "@/lib/schedule/timeline-utils";
import type { Task, TimelineColumn, ViewMode, WorkLog } from "@/lib/schedule/types";
import { useCallback, useMemo, useState } from "react";

type TimelineCellsProps = {
  projectId: string;
  task: Task;
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
  dayLayouts?: DayColumnLayout[];
  sessionExpands?: Record<string, { early: boolean; late: boolean }>;
  /** Replay 등: 드래그/생성 비활성 */
  readOnly?: boolean;
};

type NoteTarget = {
  workLog: WorkLog;
  anchor: { x: number; y: number };
};

function formatWorkLogTitle(log: WorkLog): string {
  const { startedAt, endedAt, note } = log;
  const sameDay = startedAt.slice(0, 10) === endedAt.slice(0, 10);
  const time = sameDay
    ? `${startedAt.slice(5, 10)} ${startedAt.slice(11, 16)}–${endedAt.slice(11, 16)}`
    : `${startedAt.slice(0, 16)}–${endedAt.slice(0, 16)}`;
  return note ? `${time} — ${note}` : time;
}

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
  dayLayouts,
  sessionExpands = {},
  readOnly = false,
}: TimelineCellsProps) {
  const isDayView = viewMode === "day";
  const totalWidth =
    isDayView && dayLayouts
      ? totalDayLayoutsWidth(dayLayouts)
      : columns.length * columnWidth;
  const isWorkLogEditable = !readOnly && viewMode === "day";
  const isMemoView = isWorkLogEditable;
  const isPlanEditable = !readOnly && (viewMode === "week" || viewMode === "month");
  const showPlan = viewMode === "week" || viewMode === "month";
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);

  const handleBarClick = useCallback(
    (workLogId: string, anchor: { x: number; y: number }) => {
      if (!isMemoView) return;
      const workLog = task.workLogs.find((l) => l.id === workLogId);
      if (!workLog) return;
      setNoteTarget({ workLog, anchor });
    },
    [isMemoView, task.workLogs],
  );

  const {
    containerRef: workLogContainerRef,
    preview: workLogPreview,
    pending: workLogPending,
    draggingWorkLogId,
    startCreate: startWorkLogCreate,
    startBarPointerDown: startWorkLogBarPointerDown,
  } = useWorkLogDrag({
    projectId,
    taskId: task.id,
    columns,
    columnWidth,
    viewMode,
    workLogs: task.workLogs,
    dayLayouts: isDayView ? dayLayouts : undefined,
    onBarClick: isMemoView ? handleBarClick : undefined,
  });

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
        ),
      ),
    [task.workLogs, viewMode, columns, columnWidth, isDayView, dayLayouts],
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
            setNoteTarget(null);
            startWorkLogCreate(e.clientX);
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
          const session = sessionExpands[col.startDate];
          const headerExpanded = Boolean(session?.early || session?.late);
          const showDayGuides =
            isDayView &&
            layout &&
            getDayHourTicksVisible(columnWidth, headerExpanded);
          const monthMode =
            viewMode === "month" ? getMonthTickMode(columnWidth) : "none";
          return (
            <div
              key={col.key}
              className="relative h-full shrink-0 border-r border-zinc-300 last:border-r-0 dark:border-zinc-700"
              style={{ width }}
            >
              {showDayGuides ? (
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

          return (
            <WorkLogGanttBar
              key={seg.segmentKey}
              workLogId={seg.workLogId}
              status={task.status}
              left={seg.left}
              width={seg.width}
              title={formatWorkLogTitle(log)}
              hasNote={isMemoView && Boolean(log.note)}
              interactive={isWorkLogEditable}
              disabled={pending}
              onBarPointerDown={
                isWorkLogEditable ? startWorkLogBarPointerDown : undefined
              }
              onBarClick={isMemoView ? handleBarClick : undefined}
            />
          );
        })}

        {workLogPreviewSegment ? (
          <WorkLogGanttBar
            workLogId="__preview__"
            status={task.status}
            left={workLogPreviewSegment.left}
            width={workLogPreviewSegment.width}
            title="미리보기"
            isPreview
            disabled
            interactive={false}
          />
        ) : null}
      </div>

      {noteTarget ? (
        <WorkLogNotePopover
          projectId={projectId}
          workLog={noteTarget.workLog}
          anchor={noteTarget.anchor}
          onClose={() => setNoteTarget(null)}
        />
      ) : null}
    </td>
  );
}
