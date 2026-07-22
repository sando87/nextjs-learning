"use client";

import { updateTaskDatesAction } from "@/app/schedule/actions";
import { getPlanBarPlacement } from "@/lib/schedule/plan-bar-placements";
import {
  datesToPlanSlotRange,
  getPlanDaySlotCount,
  planSlotsToDates,
  xToPlanDaySlot,
} from "@/lib/schedule/plan-timeline-utils";
import type { TimelineColumn } from "@/lib/schedule/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type PlanDragMode = "create" | "resize-start" | "resize-end" | "move";

type DragState = {
  mode: PlanDragMode;
  anchorSlot: number;
  currentSlot: number;
  origStart: number;
  origEndExclusive: number;
};

export type PlanPreview = {
  startSlot: number;
  endExclusiveSlot: number;
  isNew: boolean;
};

type PendingBar = {
  mode: Exclude<PlanDragMode, "create">;
  anchorSlot: number;
  origStart: number;
  origEndExclusive: number;
  startX: number;
  startY: number;
};

const DRAG_THRESHOLD_PX = 5;

type UsePlanDragOptions = {
  projectId: string;
  taskId: string;
  columns: TimelineColumn[];
  columnWidth: number;
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
};

function computePreview(state: DragState, slotCount: number): PlanPreview {
  const { mode, anchorSlot, currentSlot, origStart, origEndExclusive } = state;

  if (mode === "create") {
    const start = Math.min(anchorSlot, currentSlot);
    const end = Math.max(anchorSlot, currentSlot) + 1;
    return { startSlot: start, endExclusiveSlot: end, isNew: true };
  }

  if (mode === "resize-start") {
    // 끝까지 줄이면 start === endExclusive → 삭제 대상
    const start = Math.max(0, Math.min(currentSlot, origEndExclusive));
    return {
      startSlot: start,
      endExclusiveSlot: origEndExclusive,
      isNew: false,
    };
  }

  if (mode === "resize-end") {
    const endEx = Math.max(origStart, Math.min(slotCount, currentSlot + 1));
    return {
      startSlot: origStart,
      endExclusiveSlot: endEx,
      isNew: false,
    };
  }

  const span = origEndExclusive - origStart;
  const delta = currentSlot - anchorSlot;
  let start = origStart + delta;
  start = Math.max(0, Math.min(slotCount - span, start));
  return {
    startSlot: start,
    endExclusiveSlot: start + span,
    isNew: false,
  };
}

export function usePlanDrag({
  projectId,
  taskId,
  columns,
  columnWidth,
  startDate,
  endDate,
  enabled,
}: UsePlanDragOptions) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingBarRef = useRef<PendingBar | null>(null);

  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);

  const slotCount = getPlanDaySlotCount(columns);
  const hasPlan = Boolean(startDate && endDate);

  const slotAt = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return xToPlanDaySlot(clientX, rect.left, columnWidth, columns);
    },
    [columnWidth, columns],
  );

  const activateBarDrag = useCallback((pendingBar: PendingBar) => {
    dragRef.current = {
      mode: pendingBar.mode,
      anchorSlot: pendingBar.anchorSlot,
      currentSlot: pendingBar.anchorSlot,
      origStart: pendingBar.origStart,
      origEndExclusive: pendingBar.origEndExclusive,
    };
    setDragging(true);
    setPreview({
      startSlot: pendingBar.origStart,
      endExclusiveSlot: pendingBar.origEndExclusive,
      isNew: false,
    });
  }, []);

  const persist = useCallback(
    async (state: DragState, range: PlanPreview) => {
      setPending(true);
      try {
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("taskId", taskId);

        // 리사이즈로 길이가 0이 되면 계획 일정 삭제
        if (
          state.mode !== "create" &&
          range.endExclusiveSlot <= range.startSlot
        ) {
          fd.set("startDate", "");
          fd.set("endDate", "");
          await updateTaskDatesAction(fd);
          return;
        }

        if (range.endExclusiveSlot <= range.startSlot) return;

        const dates = planSlotsToDates(
          columns,
          range.startSlot,
          range.endExclusiveSlot,
        );
        if (!dates) return;

        fd.set("startDate", dates.startDate);
        fd.set("endDate", dates.endDate);
        await updateTaskDatesAction(fd);
      } finally {
        setPending(false);
        router.refresh();
      }
    },
    [columns, projectId, taskId, router],
  );

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    setDragging(false);
    if (!state) return;
    const range = computePreview(state, slotCount);
    void persist(state, range);
  }, [persist, slotCount]);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => {
      const pendingBar = pendingBarRef.current;
      if (pendingBar && !dragRef.current) {
        const dx = e.clientX - pendingBar.startX;
        const dy = e.clientY - pendingBar.startY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          pendingBarRef.current = null;
          activateBarDrag(pendingBar);
        } else {
          return;
        }
      }

      const state = dragRef.current;
      if (!state) return;
      state.currentSlot = slotAt(e.clientX);
      setPreview(computePreview(state, slotCount));
    };

    const onUp = () => {
      if (pendingBarRef.current && !dragRef.current) {
        pendingBarRef.current = null;
        return;
      }
      endDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [activateBarDrag, enabled, endDrag, slotAt, slotCount]);

  const startCreate = useCallback(
    (clientX: number) => {
      if (!enabled || pending || hasPlan || pendingBarRef.current) return;
      const slot = slotAt(clientX);
      dragRef.current = {
        mode: "create",
        anchorSlot: slot,
        currentSlot: slot,
        origStart: slot,
        origEndExclusive: slot + 1,
      };
      setDragging(true);
      setPreview({ startSlot: slot, endExclusiveSlot: slot + 1, isNew: true });
    },
    [enabled, hasPlan, pending, slotAt],
  );

  const startBarPointerDown = useCallback(
    (
      mode: Exclude<PlanDragMode, "create">,
      clientX: number,
      clientY: number,
    ) => {
      if (!enabled || pending || !startDate || !endDate) return;
      const range = datesToPlanSlotRange(startDate, endDate, columns);
      if (!range) return;

      pendingBarRef.current = {
        mode,
        anchorSlot: slotAt(clientX),
        origStart: range.startSlot,
        origEndExclusive: range.endExclusiveSlot,
        startX: clientX,
        startY: clientY,
      };
    },
    [columns, enabled, endDate, pending, slotAt, startDate],
  );

  const previewPlacement = preview
    ? (() => {
        if (preview.endExclusiveSlot <= preview.startSlot) return null;
        const dates = planSlotsToDates(
          columns,
          preview.startSlot,
          preview.endExclusiveSlot,
        );
        if (!dates) return null;
        return getPlanBarPlacement(
          dates.startDate,
          dates.endDate,
          columns,
          columnWidth,
        );
      })()
    : null;

  return {
    containerRef,
    preview,
    previewPlacement,
    pending,
    dragging,
    hasPlan,
    startCreate,
    startBarPointerDown,
  };
}

export function getPlanBarDragMode(
  clientX: number,
  rect: DOMRect,
): Exclude<PlanDragMode, "create"> {
  const HANDLE = 6;
  const x = clientX - rect.left;
  if (x <= HANDLE) return "resize-start";
  if (x >= rect.width - HANDLE) return "resize-end";
  return "move";
}
