"use client";

import GanttBar from "@/components/schedule/GanttBar";
import {
  getBarDragMode,
  type WorkLogDragMode,
} from "@/components/schedule/use-work-log-drag";
import type { TaskStatus } from "@/lib/schedule/types";
import { useEffect, useRef, useState } from "react";

type WorkLogGanttBarProps = {
  status: TaskStatus;
  left: number;
  width: number;
  /** 툴팁·바 안 표시용 한 줄 메모 (날짜 없음) */
  note?: string | null;
  workLogId: string;
  isPreview?: boolean;
  selected?: boolean;
  /** 바 위 인라인 메모 편집 중 */
  editingNote?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  onSelect?: (workLogId: string) => void;
  onEditNote?: (workLogId: string) => void;
  onCommitNote?: (workLogId: string, note: string) => void;
  onCancelNote?: () => void;
  onBarPointerDown?: (
    mode: Exclude<WorkLogDragMode, "create">,
    workLogId: string,
    clientX: number,
    clientY: number,
  ) => void;
};

export default function WorkLogGanttBar({
  status,
  left,
  width,
  note,
  workLogId,
  isPreview,
  selected = false,
  editingNote = false,
  interactive = false,
  disabled,
  onSelect,
  onEditNote,
  onCommitNote,
  onCancelNote,
  onBarPointerDown,
}: WorkLogGanttBarProps) {
  const noteText = note?.trim() ? note.trim() : "";
  const canDrag =
    interactive && selected && !editingNote && Boolean(onBarPointerDown);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(noteText);

  useEffect(() => {
    if (!editingNote) return;
    setDraft((note ?? "").replace(/\s+/g, " ").trim());
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingNote, note]);

  return (
    <div
      data-work-log-bar={workLogId}
      className={`absolute top-1/2 h-5 -translate-y-1/2 ${
        isPreview ? "opacity-60" : ""
      } ${selected && !isPreview ? "z-10" : ""}`}
      style={{ left, width: Math.max(width, 3) }}
      title={!editingNote && noteText ? noteText : undefined}
      onPointerDown={(e) => {
        if (disabled || isPreview || editingNote) return;
        e.stopPropagation();
        // 다른 바 선택 시 이전 선택/편집/드래그를 즉시 중단
        if (!selected) {
          onSelect?.(workLogId);
          return;
        }
        if (canDrag) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const mode = getBarDragMode(e.clientX, rect);
          onBarPointerDown?.(mode, workLogId, e.clientX, e.clientY);
        }
      }}
      onClick={(e) => {
        if (disabled || isPreview || editingNote) return;
        e.stopPropagation();
        // 선택 상태 클릭(드래그 없음)은 훅 → onEditNote
        if (selected && canDrag) return;
        if (selected) {
          onEditNote?.(workLogId);
        }
      }}
    >
      <GanttBar
        status={status}
        startIndex={0}
        span={1}
        columnWidth={width}
        variant="work"
        embedded
        className={`${
          disabled
            ? ""
            : canDrag
              ? "cursor-pointer active:cursor-grabbing"
              : "cursor-pointer"
        } ${
          selected && !isPreview
            ? "ring-2 ring-sky-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900"
            : ""
        }`}
      />
      {editingNote && !isPreview ? (
        <input
          ref={inputRef}
          data-work-log-note
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value.replace(/\n/g, ""))}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder="메모"
          className="absolute inset-x-0.5 inset-y-0 z-10 bg-transparent text-[10px] font-medium leading-none text-zinc-950 outline-none dark:text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitNote?.(workLogId, draft.trim());
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelNote?.();
            }
          }}
          onBlur={() => onCommitNote?.(workLogId, draft.trim())}
        />
      ) : noteText && !isPreview ? (
        <span
          className="pointer-events-none absolute inset-x-0.5 top-1/2 -translate-y-1/2 truncate text-[10px] font-medium leading-none text-zinc-950 dark:text-white"
          aria-hidden
        >
          {noteText}
        </span>
      ) : null}
      {canDrag && !disabled && !isPreview ? (
        <>
          <div className="absolute inset-y-0 left-0 w-1.5 cursor-w-resize" />
          <div className="absolute inset-y-0 right-0 w-1.5 cursor-e-resize" />
        </>
      ) : null}
    </div>
  );
}
