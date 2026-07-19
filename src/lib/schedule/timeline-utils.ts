import type { TimelineColumn, ViewMode, WorkLog } from "./types";

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateStr(date: Date): string {
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

function parseDateTime(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  const [datePart, timePart = "00:00:00"] = normalized.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm = "0", ss = "0"] = timePart.split(":");
  return new Date(y, m - 1, d, Number(hh), Number(mm), Number(ss));
}

function latestBound(
  taskEndDates: (string | null)[],
  workLogEndAts: string[],
): Date | null {
  const dates = [
    ...taskEndDates.filter((d): d is string => d !== null).map(parseDate),
    ...workLogEndAts.map((v) => {
      const dt = parseDateTime(v);
      // ended_at이 정시면 그날까지 컬럼이 필요 (00:00이면 전날까지만)
      if (
        dt.getHours() === 0 &&
        dt.getMinutes() === 0 &&
        dt.getSeconds() === 0
      ) {
        return addDays(dt, -1);
      }
      return dt;
    }),
  ];
  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.getTime() - a.getTime())[0];
}

function generateHourColumns(
  projectStartDate: string,
  taskEndDates: (string | null)[],
  workLogEndAts: string[],
  dayCount = 7,
): TimelineColumn[] {
  const start = parseDate(projectStartDate);
  const latest = latestBound(taskEndDates, workLogEndAts);
  let days = dayCount;
  if (latest) {
    const span =
      Math.ceil((latest.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
      1;
    days = Math.max(dayCount, span);
  }

  const columns: TimelineColumn[] = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(start, d);
    const dateStr = formatDateStr(day);
    for (let hour = 0; hour < 24; hour++) {
      columns.push({
        key: `${dateStr}T${String(hour).padStart(2, "0")}`,
        label: hour === 0 ? `${day.getMonth() + 1}/${day.getDate()} ${hour}` : String(hour).padStart(2, "0"),
        startDate: dateStr,
        endDate: dateStr,
        hour,
      });
    }
  }
  return columns;
}

export function generateTimelineColumns(
  viewMode: ViewMode,
  projectStartDate: string,
  taskEndDates: (string | null)[],
  count = 14,
  workLogEndAts: string[] = [],
): TimelineColumn[] {
  if (viewMode === "hour") {
    return generateHourColumns(
      projectStartDate,
      taskEndDates,
      workLogEndAts,
      Math.max(count, 7),
    );
  }

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
        key: formatDateStr(day),
        label,
        startDate: formatDateStr(day),
        endDate: formatDateStr(day),
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
        startDate: formatDateStr(ws),
        endDate: formatDateStr(we),
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
      startDate: formatDateStr(ms),
      endDate: formatDateStr(me),
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

/** ended_at은 미포함(half-open). 09:00–11:00 → 9시·10시 칸 */
export function getWorkLogColumnSpan(
  startedAt: string,
  endedAt: string,
  columns: TimelineColumn[],
): { startIndex: number; span: number } | null {
  if (columns.length === 0 || columns[0].hour === undefined) {
    return null;
  }

  const start = parseDateTime(startedAt);
  const end = parseDateTime(endedAt);

  let startIndex = -1;
  let endIndex = -1;

  columns.forEach((col, index) => {
    const day = parseDate(col.startDate);
    const colStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      col.hour ?? 0,
      0,
      0,
    );
    const colEnd = new Date(colStart.getTime() + 60 * 60 * 1000);
    const overlaps = start < colEnd && end > colStart;
    if (overlaps) {
      if (startIndex === -1) startIndex = index;
      endIndex = index;
    }
  });

  if (startIndex === -1) return null;
  return { startIndex, span: endIndex - startIndex + 1 };
}

export function totalWorkLogHours(workLogs: WorkLog[]): number {
  return workLogs.reduce((sum, log) => {
    const start = parseDateTime(log.startedAt).getTime();
    const end = parseDateTime(log.endedAt).getTime();
    return sum + (end - start) / (1000 * 60 * 60);
  }, 0);
}

export function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}
