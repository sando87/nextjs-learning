"use client";

import { quickUpdateTaskAction } from "@/app/schedule/actions";
import {
  getLastVisibleMetaKey,
  getMetaStickyLefts,
  META_COLUMN_WIDTHS,
  type ColumnKey,
  type MetaColumnKey,
} from "@/components/schedule/schedule-board-state";
import { totalWorkLogHours } from "@/lib/schedule/timeline-utils";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  TASK_STATUSES,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from "@/lib/schedule/types";
import { type DragEvent, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";

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
  /** Replay: 제어 컴포넌트로 상태 반영, 편집 비활성 */
  readOnly?: boolean;
};

const cellClass =
  "border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700";

/** border 틈을 막기 위해 배경을 1px 바깥까지 깔음 */
const stickyShell =
  "sticky z-10 relative before:pointer-events-none before:absolute before:-inset-px before:-z-10";

const stickyEdge =
  "after:pointer-events-none after:absolute after:inset-y-0 after:-right-px after:z-[1] after:w-px after:bg-zinc-400/90 after:content-[''] dark:after:bg-zinc-500 shadow-[4px_0_10px_-6px_rgba(0,0,0,0.28)] dark:shadow-[4px_0_10px_-6px_rgba(0,0,0,0.55)]";

function stickyStyle(key: MetaColumnKey, lefts: Partial<Record<MetaColumnKey, number>>) {
  const width = META_COLUMN_WIDTHS[key];
  return {
    left: lefts[key] ?? 0,
    width,
    minWidth: width,
    maxWidth: width,
  };
}

function stickyCellClass(
  key: MetaColumnKey,
  lastKey: MetaColumnKey,
  bg: string,
  beforeBg: string,
  extra = "",
) {
  const edge = key === lastKey ? stickyEdge : "";
  return `${cellClass} ${stickyShell} ${bg} ${beforeBg} ${edge} ${extra}`.trim();
}

/** planned은 간트와 같이 채움 없음 → sticky용 불투명 배경만 */
function stateCellBg(status: TaskStatus) {
  if (status === "planned") return "bg-white dark:bg-black";
  return STATUS_COLORS[status];
}

function stateBeforeBg(status: TaskStatus) {
  if (status === "planned") return "before:bg-white dark:before:bg-black";
  if (status === "doing") return "before:bg-orange-400";
  if (status === "done") return "before:bg-green-500";
  return "before:bg-zinc-400";
}

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
  readOnly = false,
}: TaskMetaCellsProps) {
  const stickyLefts = getMetaStickyLefts(visibleColumns);
  const lastMetaKey = getLastVisibleMetaKey(visibleColumns);
  // 셀 배경은 즉시 반영; props 동기화는 서버 반영 후
  const [status, setStatus] = useState(task.status);
  useEffect(() => {
    setStatus(task.status);
  }, [task.status]);

  const dropLine =
    showDropIndicatorAbove && showDropIndicatorBelow
      ? "shadow-[inset_0_2px_0_0_#0ea5e9,inset_0_-2px_0_0_#0ea5e9]"
      : showDropIndicatorAbove
        ? "shadow-[inset_0_2px_0_0_#0ea5e9]"
        : showDropIndicatorBelow
          ? "shadow-[inset_0_-2px_0_0_#0ea5e9]"
          : "";

  const titleBg = nestHighlight
    ? "bg-sky-100 ring-2 ring-inset ring-sky-400 dark:bg-sky-950/50 dark:ring-sky-500"
    : "bg-white dark:bg-black";
  const titleBefore = nestHighlight
    ? "before:bg-sky-100 dark:before:bg-sky-950"
    : "before:bg-white dark:before:bg-black";

  const isNest = dragMode === "nest";
  const plainBg = "bg-white dark:bg-black";
  const plainBefore = "before:bg-white dark:before:bg-black";

  return (
    <>
      <td
        className={stickyCellClass(
          "title",
          lastMetaKey,
          titleBg,
          titleBefore,
          dropLine,
        )}
        style={stickyStyle("title", stickyLefts)}
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
            disabled={readOnly}
            onPointerDown={
              isNest && !readOnly
                ? (e) => onNestPointerDown?.(e)
                : undefined
            }
            onClick={() => {
              if (readOnly) return;
              onEdit(task);
            }}
            onDoubleClick={() => {
              if (readOnly) return;
              const next = prompt("업무 이름", task.title);
              if (next === null) return;
              const fd = new FormData();
              fd.set("projectId", projectId);
              fd.set("taskId", task.id);
              fd.set("field", "title");
              fd.set("value", next);
              void quickUpdateTaskAction(fd);
            }}
            className={`min-w-0 flex-1 text-left font-medium hover:underline disabled:cursor-default disabled:no-underline ${isNest
              ? "cursor-grab touch-none select-none active:cursor-grabbing"
              : ""
              }`}
          >
            {task.title}
          </button>
        </div>
      </td>

      {visibleColumns.worker ? (
        <td
          className={stickyCellClass("worker", lastMetaKey, plainBg, plainBefore)}
          style={stickyStyle("worker", stickyLefts)}
        >
          <select
            {...(readOnly
              ? { value: task.assigneeId ?? "", disabled: true }
              : { defaultValue: task.assigneeId ?? "" })}
            onChange={(e) => {
              if (readOnly) return;
              const fd = new FormData();
              fd.set("projectId", projectId);
              fd.set("taskId", task.id);
              fd.set("field", "assigneeId");
              fd.set("value", e.target.value);
              void quickUpdateTaskAction(fd);
            }}
            className="w-full bg-transparent text-xs outline-none disabled:cursor-default disabled:opacity-100"
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
        <td
          className={stickyCellClass(
            "state",
            lastMetaKey,
            stateCellBg(status),
            stateBeforeBg(status),
          )}
          style={stickyStyle("state", stickyLefts)}
        >
          <select
            value={status}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              const next = e.target.value as TaskStatus;
              setStatus(next);
              const fd = new FormData();
              fd.set("projectId", projectId);
              fd.set("taskId", task.id);
              fd.set("field", "status");
              fd.set("value", next);
              void quickUpdateTaskAction(fd);
            }}
            className="w-full bg-transparent text-xs outline-none disabled:cursor-default disabled:opacity-100"
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
        <td
          className={stickyCellClass(
            "priority",
            lastMetaKey,
            plainBg,
            plainBefore,
            "text-center",
          )}
          style={stickyStyle("priority", stickyLefts)}
        >
          {task.priority}
        </td>
      ) : null}

      {visibleColumns.tags ? (
        <td
          className={stickyCellClass("tags", lastMetaKey, plainBg, plainBefore)}
          style={stickyStyle("tags", stickyLefts)}
        >
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
        <td
          className={stickyCellClass(
            "workHours",
            lastMetaKey,
            plainBg,
            plainBefore,
            "text-center",
          )}
          style={stickyStyle("workHours", stickyLefts)}
        >
          {totalWorkLogHours(task.workLogs)}h
        </td>
      ) : null}
    </>
  );
}
