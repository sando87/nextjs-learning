import type { Task, TimelineColumn } from "@/lib/schedule/types";

/** 진행중·예정·보류는 항상 표시 */
const ALWAYS_VISIBLE = new Set<string>(["planned", "doing", "hold"]);

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** updated_at(ISO) → 로컬 캘린더 날짜 YYYY-MM-DD */
export function taskUpdatedDateStr(updatedAt: string): string {
  return formatYmd(new Date(updatedAt));
}

export function chartWindowDateRange(
  columns: TimelineColumn[],
): { startDate: string; endDate: string } | null {
  if (columns.length === 0) return null;
  return {
    startDate: columns[0].startDate,
    endDate: columns[columns.length - 1].endDate,
  };
}

/**
 * 활성 상태는 항상 표시.
 * 완료는 updated_at 날짜가 차트 윈도우 [start, end] 안에 있을 때만.
 */
export function isTaskInChartWindow(
  task: Task,
  windowStart: string | null,
  windowEnd: string | null,
): boolean {
  if (ALWAYS_VISIBLE.has(task.status)) return true;
  if (task.status !== "done") return true;
  if (!windowStart || !windowEnd) return true;

  const updated = taskUpdatedDateStr(task.updatedAt);
  return updated >= windowStart && updated <= windowEnd;
}

export function filterTasksByChartWindow(
  tasks: Task[],
  columns: TimelineColumn[],
): Task[] {
  const range = chartWindowDateRange(columns);
  if (!range) return tasks.filter((t) => ALWAYS_VISIBLE.has(t.status));
  return tasks.filter((t) =>
    isTaskInChartWindow(t, range.startDate, range.endDate),
  );
}
