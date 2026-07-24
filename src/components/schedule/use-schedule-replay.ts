"use client";

import { getScheduleChangeEventsAction } from "@/app/schedule/actions";
import {
  useReplayClock,
  type ReplayStepUnit,
} from "@/components/schedule/use-replay-clock";
import {
  applyEventsUpTo,
  getEventsUpTo,
  mergeWorkLogsForReplay,
  tasksWithReplayedWorkLogs,
} from "@/lib/schedule/replay-events";
import type {
  ScheduleChangeEvent,
  Task,
  TimelineColumn,
} from "@/lib/schedule/types";
import { useEffect, useMemo, useState } from "react";

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateTimeLabel(ms: number): string {
  const d = new Date(ms);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function columnRangeMs(col: TimelineColumn) {
  const start = parseDate(col.startDate);
  start.setHours(0, 0, 0, 0);
  const end = parseDate(col.endDate);
  end.setHours(23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/** 타임라인 전체 구간 */
function timelineRange(columns: TimelineColumn[]) {
  if (columns.length === 0) {
    const now = Date.now();
    return { startMs: now, endMs: now + 1, startIso: "", endIso: "" };
  }
  const first = columnRangeMs(columns[0]);
  const last = columnRangeMs(columns[columns.length - 1]);
  return {
    startMs: first.startMs,
    endMs: last.endMs,
    startIso: new Date(first.startMs).toISOString(),
    endIso: new Date(last.endMs).toISOString(),
  };
}

/** playhead ms → 타임라인 내 left(px) */
export function playheadMsToLeft(
  ms: number,
  columns: TimelineColumn[],
  columnWidth: number,
): number {
  if (columns.length === 0) return 0;
  for (let i = 0; i < columns.length; i++) {
    const { startMs, endMs } = columnRangeMs(columns[i]);
    const span = Math.max(1, endMs - startMs);
    if (ms < startMs) return i * columnWidth;
    if (ms <= endMs) {
      return i * columnWidth + ((ms - startMs) / span) * columnWidth;
    }
  }
  return columns.length * columnWidth;
}

/** 타임라인 내 left(px) → playhead ms */
export function leftToPlayheadMs(
  left: number,
  columns: TimelineColumn[],
  columnWidth: number,
): number {
  if (columns.length === 0) return Date.now();
  const total = columns.length * columnWidth;
  const x = Math.min(total, Math.max(0, left));
  const idx = Math.min(
    columns.length - 1,
    Math.max(0, Math.floor(x / columnWidth)),
  );
  const frac = (x - idx * columnWidth) / columnWidth;
  const { startMs, endMs } = columnRangeMs(columns[idx]);
  return startMs + frac * Math.max(1, endMs - startMs);
}

type UseScheduleReplayOptions = {
  enabled: boolean;
  projectId: string;
  columns: TimelineColumn[];
  tasks: Task[];
  columnWidth: number;
  sessionId: number;
};

export function useScheduleReplay({
  enabled,
  projectId,
  columns,
  tasks,
  columnWidth,
  sessionId,
}: UseScheduleReplayOptions) {
  const [stepUnit, setStepUnit] = useState<ReplayStepUnit>("hour");
  const [fetchedEvents, setFetchedEvents] = useState<ScheduleChangeEvent[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => timelineRange(columns), [columns]);

  const nowMs = Date.now();
  const initialMs =
    nowMs >= range.startMs && nowMs <= range.endMs ? nowMs : range.endMs;

  const clock = useReplayClock({
    rangeStartMs: range.startMs,
    rangeEndMs: range.endMs,
    enabled,
    resetToken: sessionId,
    initialMs,
    stepUnit,
  });

  useEffect(() => {
    if (!enabled || columns.length === 0) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    // 타임라인 끝까지의 전체 이력 (시점 스냅샷 복원용)
    void getScheduleChangeEventsAction(
      projectId,
      "1970-01-01T00:00:00.000Z",
      range.endIso,
    ).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setFetchedEvents(result.events);
      else setFetchedEvents([]);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, columns.length, range.endIso]);

  const events = useMemo(
    () => (enabled ? fetchedEvents : []),
    [enabled, fetchedEvents],
  );
  const playheadIso = new Date(clock.playheadMs).toISOString();

  const replayedTasks = useMemo(() => {
    if (!enabled) return tasks;
    const state = applyEventsUpTo(events, playheadIso);
    const currentLogs = tasks.flatMap((t) => t.workLogs);
    const merged = mergeWorkLogsForReplay(state, currentLogs);
    return tasksWithReplayedWorkLogs(tasks, merged, state);
  }, [enabled, tasks, events, playheadIso]);

  const highlightTaskId = useMemo(() => {
    if (!enabled) return null;
    const upTo = getEventsUpTo(events, playheadIso);
    const latest = upTo[upTo.length - 1];
    if (!latest) return null;
    return (
      latest.taskId ??
      (latest.entityType === "task" ? latest.entityId : null)
    );
  }, [enabled, events, playheadIso]);

  const playheadLeftInTimeline = playheadMsToLeft(
    clock.playheadMs,
    columns,
    columnWidth,
  );

  const seekByTimelineLeft = (leftInTimeline: number) => {
    clock.seekMs(leftToPlayheadMs(leftInTimeline, columns, columnWidth));
  };

  return {
    stepUnit,
    setStepUnit,
    clock,
    playheadLabel: formatDateTimeLabel(clock.playheadMs),
    playheadLeftInTimeline,
    seekByTimelineLeft,
    stepBack: () => clock.stepBy(stepUnit, -1),
    stepForward: () => clock.stepBy(stepUnit, 1),
    replayedTasks,
    highlightTaskId,
    loading: enabled && loading,
    timelineWidth: columns.length * columnWidth,
  };
}
