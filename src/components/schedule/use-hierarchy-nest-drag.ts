"use client";

import { isDescendantOf } from "@/lib/schedule/task-tree";
import type { Task } from "@/lib/schedule/types";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export type NestDropTarget =
  | { kind: "task"; taskId: string }
  | { kind: "root" }
  | null;

const DRAG_THRESHOLD_PX = 6;

type UseHierarchyNestDragOptions = {
  enabled: boolean;
  tasks: Task[];
  /** 차트(테이블) 영역 — 이 밖이면 root로 이동 */
  chartRef: RefObject<HTMLElement | null>;
  onNest: (taskId: string, parentId: string | null) => void;
};

/**
 * Hierarchy 부모 할당: threshold 이후에만 드래그 시작 → 클릭으로 상세 열기 가능.
 * 차트 바깥에 놓으면 parent = null (root).
 */
export function useHierarchyNestDrag({
  enabled,
  tasks,
  chartRef,
  onNest,
}: UseHierarchyNestDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<NestDropTarget>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const onNestRef = useRef(onNest);
  onNestRef.current = onNest;
  const chartRefStable = useRef(chartRef);
  chartRefStable.current = chartRef;

  const resolveTarget = useCallback(
    (clientX: number, clientY: number, movedId: string): NestDropTarget => {
      const chart = chartRefStable.current.current;
      if (chart) {
        const rect = chart.getBoundingClientRect();
        const inside =
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom;
        if (!inside) return { kind: "root" };
      }

      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return { kind: "root" };

      const row = el.closest("[data-task-id]");
      const targetId = row?.getAttribute("data-task-id");
      if (!targetId || targetId === movedId) return null;
      if (isDescendantOf(tasksRef.current, movedId, targetId)) return null;
      return { kind: "task", taskId: targetId };
    },
    [],
  );

  const onTitlePointerDown = useCallback(
    (taskId: string, e: ReactPointerEvent) => {
      if (!enabled || e.button !== 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let active = false;

      const onMove = (ev: PointerEvent) => {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (!active && dist >= DRAG_THRESHOLD_PX) {
          active = true;
          setDraggingId(taskId);
          setDropTarget(resolveTarget(ev.clientX, ev.clientY, taskId));
        }
        if (active) {
          setDropTarget(resolveTarget(ev.clientX, ev.clientY, taskId));
        }
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);

        if (!active) {
          setDraggingId(null);
          setDropTarget(null);
          return;
        }

        // 드래그 직후 합성 click이 상세를 여는 것 방지
        const suppressClick = (ce: MouseEvent) => {
          ce.preventDefault();
          ce.stopPropagation();
        };
        window.addEventListener("click", suppressClick, true);
        window.setTimeout(() => {
          window.removeEventListener("click", suppressClick, true);
        }, 0);

        const target = resolveTarget(ev.clientX, ev.clientY, taskId);
        setDraggingId(null);
        setDropTarget(null);

        if (!target) return;

        const current = tasksRef.current.find((t) => t.id === taskId);
        if (!current) return;

        if (target.kind === "root") {
          if (current.parentId === null) return;
          onNestRef.current(taskId, null);
          return;
        }

        if (current.parentId === target.taskId) return;
        onNestRef.current(taskId, target.taskId);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [enabled, resolveTarget],
  );

  return {
    draggingId,
    dropTarget,
    onTitlePointerDown,
  };
}
