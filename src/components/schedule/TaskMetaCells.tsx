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

type TaskMetaCellsProps = {
  task: Task;
  projectId: string;
  members: ProjectMember[];
  visibleColumns: Record<ColumnKey, boolean>;
  allTasks: Task[];
  onEdit: (task: Task) => void;
  reorderEnabled?: boolean;
  showDropIndicatorAbove?: boolean;
  showDropIndicatorBelow?: boolean;
  onDragHandleStart?: () => void;
  onDragHandleEnd?: () => void;
};

const cellClass =
  "border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700";

export default function TaskMetaCells({
  task,
  projectId,
  members,
  visibleColumns,
  allTasks,
  onEdit,
  reorderEnabled = false,
  showDropIndicatorAbove = false,
  showDropIndicatorBelow = false,
  onDragHandleStart,
  onDragHandleEnd,
}: TaskMetaCellsProps) {
  const linkedTitles = task.linkedTaskIds
    .map((id) => allTasks.find((t) => t.id === id)?.title)
    .filter(Boolean);

  const dropLine =
    showDropIndicatorAbove && showDropIndicatorBelow
      ? "shadow-[inset_0_2px_0_0_#0ea5e9,inset_0_-2px_0_0_#0ea5e9]"
      : showDropIndicatorAbove
        ? "shadow-[inset_0_2px_0_0_#0ea5e9]"
        : showDropIndicatorBelow
          ? "shadow-[inset_0_-2px_0_0_#0ea5e9]"
          : "";

  return (
    <>
      <td
        className={`${cellClass} sticky left-0 z-10 min-w-[140px] bg-white dark:bg-black ${dropLine}`}
      >
        <div className="flex items-center gap-1">
          {reorderEnabled ? (
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", task.id);
                onDragHandleStart?.();
              }}
              onDragEnd={() => onDragHandleEnd?.()}
              className="cursor-grab select-none px-0.5 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
              title="드래그하여 순서 변경"
              aria-label="드래그하여 순서 변경"
            >
              ⋮⋮
            </span>
          ) : null}
          <button
            type="button"
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
            className="min-w-0 flex-1 text-left font-medium hover:underline"
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

      {visibleColumns.links ? (
        <td className={`${cellClass} min-w-[120px] text-zinc-500`}>
          {linkedTitles.length > 0 ? linkedTitles.join(", ") : "-"}
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
