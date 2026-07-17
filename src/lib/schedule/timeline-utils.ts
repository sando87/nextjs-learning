import type { TimelineColumn, ViewMode } from "./types";

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function generateTimelineColumns(
  viewMode: ViewMode,
  projectStartDate: string,
  taskEndDates: (string | null)[],
  count = 14,
): TimelineColumn[] {
  const start = parseDate(projectStartDate);
  const latestTaskEnd = taskEndDates
    .filter((d): d is string => d !== null)
    .map(parseDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (viewMode === "day") {
    const columns: TimelineColumn[] = [];
    let minCount = count;
    if (latestTaskEnd) {
      const days =
        Math.ceil(
          (latestTaskEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
      minCount = Math.max(count, days);
    }

    for (let i = 0; i < minCount; i++) {
      const day = addDays(start, i);
      const label = `${day.getMonth() + 1}/${day.getDate()}`;
      columns.push({
        key: formatDate(day),
        label,
        startDate: formatDate(day),
        endDate: formatDate(day),
      });
    }
    return columns;
  }

  if (viewMode === "week") {
    const columns: TimelineColumn[] = [];
    const weekStart = startOfWeek(start);
    let minCount = count;

    if (latestTaskEnd) {
      const weeks =
        Math.ceil(
          (latestTaskEnd.getTime() - weekStart.getTime()) /
            (1000 * 60 * 60 * 24 * 7),
        ) + 1;
      minCount = Math.max(count, weeks);
    }

    for (let i = 0; i < minCount; i++) {
      const ws = addDays(weekStart, i * 7);
      const we = endOfWeek(ws);
      columns.push({
        key: `week-${i + 1}`,
        label: `Week ${i + 1}`,
        startDate: formatDate(ws),
        endDate: formatDate(we),
      });
    }
    return columns;
  }

  const columns: TimelineColumn[] = [];
  const monthStart = startOfMonth(start);
  let minCount = count;

  if (latestTaskEnd) {
    const months =
      (latestTaskEnd.getFullYear() - monthStart.getFullYear()) * 12 +
      (latestTaskEnd.getMonth() - monthStart.getMonth()) +
      1;
    minCount = Math.max(count, months);
  }

  for (let i = 0; i < minCount; i++) {
    const ms = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + i,
      1,
    );
    const me = endOfMonth(ms);
    columns.push({
      key: `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, "0")}`,
      label: `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, "0")}`,
      startDate: formatDate(ms),
      endDate: formatDate(me),
    });
  }

  return columns;
}

export function getTaskColumnSpan(
  startDate: string | null,
  endDate: string | null,
  columns: TimelineColumn[],
): { startIndex: number; span: number } | null {
  if (!startDate || !endDate || columns.length === 0) {
    return null;
  }

  const taskStart = parseDate(startDate);
  const taskEnd = parseDate(endDate);

  let startIndex = -1;
  let endIndex = -1;

  columns.forEach((col, index) => {
    const colStart = parseDate(col.startDate);
    const colEnd = parseDate(col.endDate);

    const overlaps = taskStart <= colEnd && taskEnd >= colStart;
    if (overlaps) {
      if (startIndex === -1) startIndex = index;
      endIndex = index;
    }
  });

  if (startIndex === -1) {
    return null;
  }

  return { startIndex, span: endIndex - startIndex + 1 };
}

export function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}
