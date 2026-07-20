"use client";

import {
  createWorkLogAction,
  deleteWorkLogAction,
  updateWorkLogAction,
} from "@/app/schedule/actions";
import {
  getSlotCount,
  shouldDeleteWorkLog,
  slotsToTimestamps,
  workLogToSlotRange,
  xToSlotIndex,
} from "@/lib/schedule/work-log-timeline-utils";
import type { TimelineColumn, ViewMode, WorkLog } from "@/lib/schedule/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type WorkLogDragMode =
  | "create"
  | "resize-start"
  | "resize-end"
  | "move";

type DragState = {
  mode: WorkLogDragMode;
  workLogId?: string;
  anchorSlot: number;
  currentSlot: number;
  origStart: number;
  origEndExclusive: number;
};

export type WorkLogPreview = {
  startSlot: number;
  endExclusiveSlot: number;
  isNew: boolean;
};

type PendingBar = {
  mode: Exclude<WorkLogDragMode, "create">;
  workLogId: string;
  anchorSlot: number;
  origStart: number;
  origEndExclusive: number;
  startX: number;
  startY: number;
};

const DRAG_THRESHOLD_PX = 5;

type UseWorkLogDragOptions = {
  projectId: string;
  taskId: string;
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
  workLogs: WorkLog[];
  onBarClick?: (workLogId: string, anchor: { x: number; y: number }) => void;
};

function computePreview(
  state: DragState,
  slotCount: number,
): WorkLogPreview {
  const { mode, anchorSlot, currentSlot, origStart, origEndExclusive } = state;

  if (mode === "create") {
    const start = Math.min(anchorSlot, currentSlot);
    const end = Math.max(anchorSlot, currentSlot) + 1;
    return { startSlot: start, endExclusiveSlot: end, isNew: true };
  }

  if (mode === "resize-start") {
    return {
      startSlot: currentSlot,
      endExclusiveSlot: origEndExclusive,
      isNew: false,
    };
  }

  if (mode === "resize-end") {
    return {
      startSlot: origStart,
      endExclusiveSlot: currentSlot + 1,
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

function splitTimestamp(ts: string): {
  date: string;
  hour: number;
} {
  return { date: ts.slice(0, 10), hour: Number(ts.slice(11, 13)) };
}

export function useWorkLogDrag({
  projectId,
  taskId,
  columns,
  columnWidth,
  viewMode,
  workLogs,
  onBarClick,
}: UseWorkLogDragOptions) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingBarRef = useRef<PendingBar | null>(null);
  const onBarClickRef = useRef(onBarClick);
  onBarClickRef.current = onBarClick;

  const [preview, setPreview] = useState<WorkLogPreview | null>(null);
  const [draggingWorkLogId, setDraggingWorkLogId] = useState<string | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const slotCount = getSlotCount(columns, viewMode);

  const slotAt = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return xToSlotIndex(
        clientX,
        rect.left,
        columnWidth,
        columns,
        viewMode,
      );
    },
    [columnWidth, columns, viewMode],
  );

  const activateBarDrag = useCallback((pendingBar: PendingBar) => {
    dragRef.current = {
      mode: pendingBar.mode,
      workLogId: pendingBar.workLogId,
      anchorSlot: pendingBar.anchorSlot,
      currentSlot: pendingBar.anchorSlot,
      origStart: pendingBar.origStart,
      origEndExclusive: pendingBar.origEndExclusive,
    };
    setDraggingWorkLogId(pendingBar.workLogId);
    setPreview({
      startSlot: pendingBar.origStart,
      endExclusiveSlot: pendingBar.origEndExclusive,
      isNew: false,
    });
  }, []);

  const persist = useCallback(
    async (state: DragState, range: WorkLogPreview) => {
      const { startedAt, endedAt } = slotsToTimestamps(
        columns,
        range.startSlot,
        range.endExclusiveSlot,
        viewMode,
      );

      setPending(true);
      try {
        if (shouldDeleteWorkLog(startedAt, endedAt)) {
          if (state.mode !== "create" && state.workLogId) {
            const fd = new FormData();
            fd.set("projectId", projectId);
            fd.set("workLogId", state.workLogId);
            await deleteWorkLogAction(fd);
          }
          return;
        }

        if (state.mode === "create") {
          const start = splitTimestamp(startedAt);
          const end = splitTimestamp(endedAt);
          const fd = new FormData();
          fd.set("projectId", projectId);
          fd.set("taskId", taskId);
          fd.set("startDate", start.date);
          fd.set("endDate", end.date);
          fd.set("startHour", String(start.hour));
          fd.set("endHour", String(end.hour));
          const result = await createWorkLogAction(fd);
          if (!result.ok) console.error(result.error);
          return;
        }

        if (!state.workLogId) return;
        const log = workLogs.find((l) => l.id === state.workLogId);
        const start = splitTimestamp(startedAt);
        const end = splitTimestamp(endedAt);
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("workLogId", state.workLogId);
        fd.set("startDate", start.date);
        fd.set("endDate", end.date);
        fd.set("startHour", String(start.hour));
        fd.set("endHour", String(end.hour));
        fd.set("note", log?.note ?? "");
        const result = await updateWorkLogAction(fd);
        if (!result.ok) console.error(result.error);
      } finally {
        setPending(false);
        router.refresh();
      }
    },
    [columns, projectId, taskId, router, viewMode, workLogs],
  );

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    setDraggingWorkLogId(null);
    if (!state) return;
    const range = computePreview(state, slotCount);
    void persist(state, range);
  }, [persist, slotCount]);

  useEffect(() => {
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
      const pendingBar = pendingBarRef.current;
      if (pendingBar && !dragRef.current) {
        pendingBarRef.current = null;
        onBarClickRef.current?.(pendingBar.workLogId, {
          x: pendingBar.startX,
          y: pendingBar.startY,
        });
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
  }, [activateBarDrag, endDrag, slotAt, slotCount]);

  const startCreate = useCallback(
    (clientX: number) => {
      if (pending || pendingBarRef.current) return;
      const slot = slotAt(clientX);
      dragRef.current = {
        mode: "create",
        anchorSlot: slot,
        currentSlot: slot,
        origStart: slot,
        origEndExclusive: slot + 1,
      };
      setDraggingWorkLogId(null);
      setPreview({ startSlot: slot, endExclusiveSlot: slot + 1, isNew: true });
    },
    [pending, slotAt],
  );

  const startBarPointerDown = useCallback(
    (
      mode: Exclude<WorkLogDragMode, "create">,
      workLogId: string,
      clientX: number,
      clientY: number,
    ) => {
      if (pending) return;
      const log = workLogs.find((l) => l.id === workLogId);
      if (!log) return;
      const range = workLogToSlotRange(
        log.startedAt,
        log.endedAt,
        columns,
        viewMode,
      );
      if (!range) return;

      pendingBarRef.current = {
        mode,
        workLogId,
        anchorSlot: slotAt(clientX),
        origStart: range.startSlot,
        origEndExclusive: range.endExclusiveSlot,
        startX: clientX,
        startY: clientY,
      };
    },
    [columns, pending, slotAt, viewMode, workLogs],
  );

  return {
    containerRef,
    preview,
    pending,
    draggingWorkLogId,
    startCreate,
    startBarPointerDown,
  };
}

export function getBarDragMode(
  clientX: number,
  rect: DOMRect,
): Exclude<WorkLogDragMode, "create"> {
  const HANDLE = 6;
  const x = clientX - rect.left;
  if (x <= HANDLE) return "resize-start";
  if (x >= rect.width - HANDLE) return "resize-end";
  return "move";
}
