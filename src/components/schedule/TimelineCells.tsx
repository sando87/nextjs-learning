"use client";

import GanttBar from "@/components/schedule/GanttBar";
import { useWorkLogDrag } from "@/components/schedule/use-work-log-drag";
import WorkLogGanttBar from "@/components/schedule/WorkLogGanttBar";
import WorkLogNotePopover from "@/components/schedule/WorkLogNotePopover";
import {
  getWorkLogBarSegments,
  previewToSegment,
} from "@/lib/schedule/work-log-bar-placements";
import { getTaskColumnSpan } from "@/lib/schedule/timeline-utils";
import type { Task, TimelineColumn, ViewMode, WorkLog } from "@/lib/schedule/types";
import { useCallback, useMemo, useState } from "react";

type TimelineCellsProps = {
  projectId: string;
  task: Task;
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
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

export default function TimelineCells({
  projectId,
  task,
  columns,
  columnWidth,
  viewMode,
}: TimelineCellsProps) {
  const totalWidth = columns.length * columnWidth;
  const isEditableView = viewMode === "hour" || viewMode === "day";
  const isMemoView = isEditableView;
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
    containerRef,
    preview,
    pending,
    draggingWorkLogId,
    startCreate,
    startBarPointerDown,
  } = useWorkLogDrag({
    projectId,
    taskId: task.id,
    columns,
    columnWidth,
    viewMode,
    workLogs: task.workLogs,
    onBarClick: isMemoView ? handleBarClick : undefined,
  });

  const workLogSegments = useMemo(
    () =>
      task.workLogs.flatMap((log) =>
        getWorkLogBarSegments(viewMode, log, columns, columnWidth),
      ),
    [task.workLogs, viewMode, columns, columnWidth],
  );

  const planSpan =
    viewMode !== "hour"
      ? getTaskColumnSpan(task.startDate, task.endDate, columns)
      : null;

  const previewSegment =
    isEditableView && preview
      ? previewToSegment(
          viewMode,
          preview.startSlot,
          preview.endExclusiveSlot,
          columnWidth,
          "__preview__",
        )
      : null;

  return (
    <td
      colSpan={columns.length}
      className="relative border border-zinc-300 p-0 dark:border-zinc-700"
      style={{ width: totalWidth, minWidth: totalWidth, height: 36 }}
    >
      <div
        ref={isEditableView ? containerRef : undefined}
        className={`relative flex h-full select-none ${
          isEditableView ? "cursor-crosshair" : ""
        }`}
        style={{ width: totalWidth }}
        onPointerDown={(e) => {
          if (!isEditableView || pending || e.button !== 0) return;
          setNoteTarget(null);
          startCreate(e.clientX);
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={`h-full shrink-0 border-r border-zinc-300 last:border-r-0 dark:border-zinc-700 ${
              viewMode === "hour" && col.hour === 0
                ? "border-l-2 border-l-zinc-400 dark:border-l-zinc-500"
                : ""
            }`}
            style={{ width: columnWidth }}
          />
        ))}

        {planSpan ? (
          <GanttBar
            status={task.status}
            startIndex={planSpan.startIndex}
            span={planSpan.span}
            columnWidth={columnWidth}
            title={`계획 ${task.startDate}–${task.endDate}`}
            variant="plan"
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
              interactive={isEditableView}
              disabled={pending}
              onBarPointerDown={isEditableView ? startBarPointerDown : undefined}
              onBarClick={isMemoView ? handleBarClick : undefined}
            />
          );
        })}

        {previewSegment ? (
          <WorkLogGanttBar
            workLogId="__preview__"
            status={task.status}
            left={previewSegment.left}
            width={previewSegment.width}
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
