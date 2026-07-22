"use client";

import { quickUpdateTaskAction } from "@/app/schedule/actions";
import type { ColumnKey } from "@/components/schedule/schedule-board-state";
import { totalWorkLogHours } from "@/lib/schedule/timeline-utils";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type ProjectMember,
  type Task,
} from "@/lib/schedule/types";
import { type DragEvent, type PointerEvent as ReactPointerEvent } from "react";

type TaskMetaCellsProps = {
  task: Task;
  projectId: string;
  members: ProjectMember[];
  visibleColumns: Record<ColumnKey, boolean>;
  onEdit: (task: Task) => void;
  /** board reorder: HTML5 DnD / hierarchy nest: 제목 pointer 드래그 */
  dragMode?: "none" | "reorder" | "nest";
  dragTitle?: string;
  depth?: number;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showDropIndicatorAbove?: boolean;
  showDropIndicatorBelow?: boolean;
  nestHighlight?: boolean;
  onDragHandleStart?: () => void;
  onDragHandleEnd?: () => void;
  onNestPointerDown?: (e: ReactPointerEvent) => void;
};

const cellClass =
  "border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700";

export default function TaskMetaCells({
  task,
  projectId,
  members,
  visibleColumns,
  onEdit,
  dragMode = "none",
  dragTitle = "드래그하여 순서 변경",
  depth = 0,
  hasChildren = false,
  collapsed = false,
  onToggleCollapse,
  showDropIndicatorAbove = false,
  showDropIndicatorBelow = false,
  nestHighlight = false,
  onDragHandleStart,
  onDragHandleEnd,
  onNestPointerDown,
}: TaskMetaCellsProps) {
  const dropLine =
    showDropIndicatorAbove && showDropIndicatorBelow
      ? "shadow-[inset_0_2px_0_0_#0ea5e9,inset_0_-2px_0_0_#0ea5e9]"
      : showDropIndicatorAbove
        ? "shadow-[inset_0_2px_0_0_#0ea5e9]"
        : showDropIndicatorBelow
          ? "shadow-[inset_0_-2px_0_0_#0ea5e9]"
          : "";

  const nestClass = nestHighlight
    ? "bg-sky-100 ring-2 ring-inset ring-sky-400 dark:bg-sky-950/50 dark:ring-sky-500"
    : "bg-white dark:bg-black";

  const isNest = dragMode === "nest";

  return (
    <>
      <td
        className={`${cellClass} sticky left-0 z-10 min-w-[160px] ${nestClass} ${dropLine}`}
      >
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: depth > 0 ? depth * 12 : undefined }}
        >
          {isNest ? (
            <button
              type="button"
              disabled={!hasChildren}
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) onToggleCollapse?.();
              }}
              className={`flex h-5 w-2 shrink-0 items-center justify-center text-lg leading-none ${hasChildren
                ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                : "cursor-default text-zinc-300 dark:text-zinc-600"
                }`}
              aria-label={
                hasChildren ? (collapsed ? "펼치기" : "접기") : undefined
              }
              title={hasChildren ? (collapsed ? "펼치기" : "접기") : undefined}
            >
              {hasChildren ? (collapsed ? "▸" : "▾") : "▸"}
            </button>
          ) : null}

          {dragMode === "reorder" ? (
            <span
              draggable
              onDragStart={(e: DragEvent) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", task.id);
                onDragHandleStart?.();
              }}
              onDragEnd={(e: DragEvent) => {
                e.stopPropagation();
                onDragHandleEnd?.();
              }}
              className="cursor-grab select-none px-0.5 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
              title={dragTitle}
              aria-label={dragTitle}
            >
              ⋮⋮
            </span>
          ) : null}

          <button
            type="button"
            title={isNest ? dragTitle : undefined}
            onPointerDown={
              isNest ? (e) => onNestPointerDown?.(e) : undefined
            }
            onClick={() => onEdit(task)}
            onDoubleClick={() => {
              const next = prompt("업무 이름", task.title);
              if (next === null) return;
              const fd = new FormData();
              fd.set("projectId", projectId);
              fd.set("taskId", task.id);
              fd.set("field", "title");
              fd.set("value", next);
              void quickUpdateTaskAction(fd);
            }}
            className={`min-w-0 flex-1 text-left font-medium hover:underline ${isNest
              ? "cursor-grab touch-none select-none active:cursor-grabbing"
              : ""
              }`}
          >
            {task.title}
          </button>
        </div>
      </td>

      {visibleColumns.worker ? (
        <td className={`${cellClass} min-w-[100px]`}>
          <select
            defaultValue={task.assigneeId ?? ""}
            onChange={(e) => {
              const fd = new FormData();
              fd.set("projectId", projectId);
              fd.set("taskId", task.id);
              fd.set("field", "assigneeId");
              fd.set("value", e.target.value);
              void quickUpdateTaskAction(fd);
            }}
            className="w-full bg-transparent text-xs outline-none"
          >
            <option value="">-</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.profile.displayName}
              </option>
            ))}
          </select>
        </td>
      ) : null}

      {visibleColumns.state ? (
        <td className={`${cellClass} min-w-[80px]`}>
          <select
            defaultValue={task.status}
            onChange={(e) => {
              const fd = new FormData();
              fd.set("projectId", projectId);
              fd.set("taskId", task.id);
              fd.set("field", "status");
              fd.set("value", e.target.value);
              void quickUpdateTaskAction(fd);
            }}
            className="w-full bg-transparent text-xs outline-none"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </td>
      ) : null}

      {visibleColumns.priority ? (
        <td className={`${cellClass} min-w-[56px] text-center`}>
          {task.priority}
        </td>
      ) : null}

      {visibleColumns.tags ? (
        <td className={`${cellClass} min-w-[120px]`}>
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded px-1 py-0.5 text-[10px] text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </td>
      ) : null}

      {visibleColumns.workHours ? (
        <td className={`${cellClass} min-w-[64px] text-center`}>
          {totalWorkLogHours(task.workLogs)}h
        </td>
      ) : null}
    </>
  );
}
