"use client";

import {
  createWorkLogAction,
  deleteWorkLogAction,
  updateWorkLogAction,
} from "@/app/schedule/actions";
import type { DayColumnLayout } from "@/lib/schedule/day-workday-layout";
import {
  computeVisibleMoveRange,
  getSlotCount,
  shouldDeleteWorkLog,
  slotsToTimestamps,
  splitSlotsByDayWorkHours,
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

type PendingCreate = {
  anchorSlot: number;
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
  dayLayouts?: DayColumnLayout[];
  onBarClick?: (workLogId: string, anchor: { x: number; y: number }) => void;
};

/** 날짜 경계 클램프 없이 미리보기 범위 계산 (저장 시 근무시 단위로 분할) */
function computePreview(
  state: DragState,
  slotCount: number,
  dayLayouts?: DayColumnLayout[],
): WorkLogPreview {
  const { mode, anchorSlot, currentSlot, origStart, origEndExclusive } = state;

  if (mode === "create") {
    const start = Math.max(0, Math.min(anchorSlot, currentSlot));
    const end = Math.min(
      slotCount,
      Math.max(anchorSlot, currentSlot) + 1,
    );
    return { startSlot: start, endExclusiveSlot: end, isNew: true };
  }

  if (mode === "resize-start") {
    const endCap = Math.min(origEndExclusive, slotCount);
    const start = Math.max(0, Math.min(currentSlot, endCap));
    return {
      startSlot: start,
      endExclusiveSlot: endCap,
      isNew: false,
    };
  }

  if (mode === "resize-end") {
    const startCap = Math.max(0, origStart);
    const endEx = Math.max(
      startCap,
      Math.min(slotCount, currentSlot + 1),
    );
    return {
      startSlot: startCap,
      endExclusiveSlot: endEx,
      isNew: false,
    };
  }

  // move: 표시 근무시만 이어 붙여 길이를 유지 (야간 공백은 건너뜀)
  if (dayLayouts && dayLayouts.length > 0) {
    const moved = computeVisibleMoveRange(
      origStart,
      origEndExclusive,
      anchorSlot,
      currentSlot,
      dayLayouts,
    );
    if (moved) {
      return { ...moved, isNew: false };
    }
  }

  const span = Math.max(1, origEndExclusive - origStart);
  const delta = currentSlot - anchorSlot;
  let start = origStart + delta;
  start = Math.max(0, Math.min(Math.max(0, slotCount - span), start));
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

function appendWorkLogFormFields(
  fd: FormData,
  startedAt: string,
  endedAt: string,
) {
  const start = splitTimestamp(startedAt);
  const end = splitTimestamp(endedAt);
  fd.set("startDate", start.date);
  fd.set("endDate", end.date);
  fd.set("startHour", String(start.hour));
  fd.set("endHour", String(end.hour));
}

export function useWorkLogDrag({
  projectId,
  taskId,
  columns,
  columnWidth,
  viewMode,
  workLogs,
  dayLayouts,
  onBarClick,
}: UseWorkLogDragOptions) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingBarRef = useRef<PendingBar | null>(null);
  const pendingCreateRef = useRef<PendingCreate | null>(null);
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
        dayLayouts,
      );
    },
    [columnWidth, columns, viewMode, dayLayouts],
  );

  const activateBarDrag = useCallback((pendingBar: PendingBar) => {
    pendingCreateRef.current = null;
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

  const activateCreateDrag = useCallback(
    (pendingCreate: PendingCreate, currentSlot?: number) => {
      pendingBarRef.current = null;
      const slot = currentSlot ?? pendingCreate.anchorSlot;
      dragRef.current = {
        mode: "create",
        anchorSlot: pendingCreate.anchorSlot,
        currentSlot: slot,
        origStart: pendingCreate.anchorSlot,
        origEndExclusive: pendingCreate.anchorSlot + 1,
      };
      setDraggingWorkLogId(null);
      setPreview(
        computePreview(
          {
            mode: "create",
            anchorSlot: pendingCreate.anchorSlot,
            currentSlot: slot,
            origStart: pendingCreate.anchorSlot,
            origEndExclusive: pendingCreate.anchorSlot + 1,
          },
          getSlotCount(columns, viewMode),
          dayLayouts,
        ),
      );
    },
    [columns, dayLayouts, viewMode],
  );

  /** 진행 중 드래그/생성을 저장 없이 중단 */
  const cancelDrag = useCallback(() => {
    pendingBarRef.current = null;
    pendingCreateRef.current = null;
    dragRef.current = null;
    setPreview(null);
    setDraggingWorkLogId(null);
  }, []);

  const persist = useCallback(
    async (state: DragState, range: WorkLogPreview) => {
      // 날짜를 넘기면 헤더 근무시 단위로 잘라 여러 로그로 저장
      const segments = splitSlotsByDayWorkHours(
        range.startSlot,
        range.endExclusiveSlot,
        dayLayouts,
        columns.length,
      );

      setPending(true);
      try {
        if (segments.length === 0) {
          if (state.mode !== "create" && state.workLogId) {
            const fd = new FormData();
            fd.set("projectId", projectId);
            fd.set("workLogId", state.workLogId);
            await deleteWorkLogAction(fd);
          }
          return;
        }

        const timestamped = segments.map((seg) =>
          slotsToTimestamps(
            columns,
            seg.startSlot,
            seg.endExclusiveSlot,
            viewMode,
          ),
        );

        const valid = timestamped.filter(
          (t) => !shouldDeleteWorkLog(t.startedAt, t.endedAt),
        );
        if (valid.length === 0) {
          if (state.mode !== "create" && state.workLogId) {
            const fd = new FormData();
            fd.set("projectId", projectId);
            fd.set("workLogId", state.workLogId);
            await deleteWorkLogAction(fd);
          }
          return;
        }

        if (state.mode === "create") {
          for (const { startedAt, endedAt } of valid) {
            const fd = new FormData();
            fd.set("projectId", projectId);
            fd.set("taskId", taskId);
            appendWorkLogFormFields(fd, startedAt, endedAt);
            const result = await createWorkLogAction(fd);
            if (!result.ok) console.error(result.error);
          }
          return;
        }

        if (!state.workLogId) return;
        const log = workLogs.find((l) => l.id === state.workLogId);
        const note = log?.note ?? "";

        const [first, ...rest] = valid;
        const updateFd = new FormData();
        updateFd.set("projectId", projectId);
        updateFd.set("workLogId", state.workLogId);
        appendWorkLogFormFields(updateFd, first.startedAt, first.endedAt);
        updateFd.set("note", note);
        const updateResult = await updateWorkLogAction(updateFd);
        if (!updateResult.ok) {
          console.error(updateResult.error);
          return;
        }

        for (const { startedAt, endedAt } of rest) {
          const fd = new FormData();
          fd.set("projectId", projectId);
          fd.set("taskId", taskId);
          appendWorkLogFormFields(fd, startedAt, endedAt);
          fd.set("note", note);
          const result = await createWorkLogAction(fd);
          if (!result.ok) console.error(result.error);
        }
      } finally {
        setPending(false);
        router.refresh();
      }
    },
    [columns, dayLayouts, projectId, taskId, router, viewMode, workLogs],
  );

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    setDraggingWorkLogId(null);
    if (!state) return;
    const range = computePreview(state, slotCount, dayLayouts);
    void persist(state, range);
  }, [dayLayouts, persist, slotCount]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pendingCreate = pendingCreateRef.current;
      if (pendingCreate && !dragRef.current) {
        const dx = e.clientX - pendingCreate.startX;
        const dy = e.clientY - pendingCreate.startY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          pendingCreateRef.current = null;
          activateCreateDrag(pendingCreate, slotAt(e.clientX));
        }
        return;
      }

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
      setPreview(computePreview(state, slotCount, dayLayouts));
    };

    const onUp = () => {
      // 클릭만으로는 생성하지 않음
      if (pendingCreateRef.current && !dragRef.current) {
        pendingCreateRef.current = null;
        return;
      }

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
  }, [
    activateBarDrag,
    activateCreateDrag,
    dayLayouts,
    endDrag,
    slotAt,
    slotCount,
  ]);

  const startCreate = useCallback(
    (clientX: number, clientY: number) => {
      if (pending || pendingBarRef.current || dragRef.current) return;
      pendingCreateRef.current = {
        anchorSlot: slotAt(clientX),
        startX: clientX,
        startY: clientY,
      };
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

      pendingCreateRef.current = null;
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
    cancelDrag,
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
