"use client";

import GanttBar from "@/components/schedule/GanttBar";
import {
  getBarDragMode,
  type WorkLogDragMode,
} from "@/components/schedule/use-work-log-drag";
import type { TaskStatus } from "@/lib/schedule/types";

type WorkLogGanttBarProps = {
  status: TaskStatus;
  left: number;
  width: number;
  title: string;
  workLogId: string;
  hasNote?: boolean;
  isPreview?: boolean;
  /** 시 뷰: 드래그·리사이즈 가능 */
  interactive?: boolean;
  disabled?: boolean;
  onBarPointerDown?: (
    mode: Exclude<WorkLogDragMode, "create">,
    workLogId: string,
    clientX: number,
    clientY: number,
  ) => void;
  onBarClick?: (
    workLogId: string,
    anchor: { x: number; y: number },
  ) => void;
};

export default function WorkLogGanttBar({
  status,
  left,
  width,
  title,
  workLogId,
  hasNote,
  isPreview,
  interactive = false,
  disabled,
  onBarPointerDown,
  onBarClick,
}: WorkLogGanttBarProps) {
  return (
    <div
      className={`absolute top-1/2 h-5 -translate-y-1/2 ${isPreview ? "opacity-60" : ""}`}
      style={{ left, width: Math.max(width, 3) }}
      onPointerDown={(e) => {
        if (disabled || isPreview) return;
        e.stopPropagation();
        if (interactive && onBarPointerDown) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const mode = getBarDragMode(e.clientX, rect);
          onBarPointerDown(mode, workLogId, e.clientX, e.clientY);
        }
      }}
      onClick={(e) => {
        if (disabled || isPreview || interactive) return;
        e.stopPropagation();
        onBarClick?.(workLogId, { x: e.clientX, y: e.clientY });
      }}
    >
      <GanttBar
        status={status}
        startIndex={0}
        span={1}
        columnWidth={width}
        title={title}
        variant="work"
        embedded
        className={
          disabled
            ? ""
            : interactive
              ? "cursor-pointer active:cursor-grabbing"
              : "cursor-pointer"
        }
      />
      {hasNote && !isPreview ? (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-white ring-1 ring-zinc-600 dark:bg-zinc-200"
          aria-hidden
        />
      ) : null}
      {interactive && !disabled && !isPreview ? (
        <>
          <div className="absolute inset-y-0 left-0 w-1.5 cursor-w-resize" />
          <div className="absolute inset-y-0 right-0 w-1.5 cursor-e-resize" />
        </>
      ) : null}
    </div>
  );
}
