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

function addDaysStr(dateStr: string, days: number): string {
  return formatDateStr(addDays(parseDate(dateStr), days));
}

function parseDateTime(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  const [datePart, timePart = "00:00:00"] = normalized.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm = "0", ss = "0"] = timePart.split(":");
  return new Date(y, m - 1, d, Number(hh), Number(mm), Number(ss));
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

export type WorkLogBarSegment = {
  segmentKey: string;
  workLogId: string;
  left: number;
  width: number;
  /** column index (hour 뷰 드래그용) */
  startIndex?: number;
  span?: number;
};

function logOverlapsRange(
  startedAt: string,
  endedAt: string,
  rangeStart: Date,
  rangeEndExclusive: Date,
): boolean {
  const start = parseDateTime(startedAt);
  const end = parseDateTime(endedAt);
  return start < rangeEndExclusive && end > rangeStart;
}

function hourViewSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  const start = parseDateTime(log.startedAt);
  const end = parseDateTime(log.endedAt);

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
    if (start < colEnd && end > colStart) {
      if (startIndex === -1) startIndex = index;
      endIndex = index;
    }
  });

  if (startIndex === -1) return [];

  const span = endIndex - startIndex + 1;
  return [
    {
      segmentKey: log.id,
      workLogId: log.id,
      left: startIndex * columnWidth + 2,
      width: Math.max(span * columnWidth - 4, 4),
      startIndex,
      span,
    },
  ];
}

/** 일 뷰: 컬럼 안에서 시작·종료 시각 비율로 위치/길이 */
function dayViewSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  const startDt = parseDateTime(log.startedAt);
  const endDt = parseDateTime(log.endedAt);

  const startDateStr = formatDateStr(startDt);
  let endDateStr = formatDateStr(endDt);
  let endFrac = endDt.getHours() / 24;

  if (
    endDt.getHours() === 0 &&
    endDt.getMinutes() === 0 &&
    endDt.getSeconds() === 0
  ) {
    endDateStr = addDaysStr(endDateStr, -1);
    endFrac = 1;
  }

  const startColIdx = columns.findIndex((c) => c.startDate === startDateStr);
  const endColIdx = columns.findIndex((c) => c.startDate === endDateStr);
  if (startColIdx === -1 || endColIdx === -1) return [];

  const startFrac = startDt.getHours() / 24;
  const left = startColIdx * columnWidth + startFrac * columnWidth + 2;
  const right = endColIdx * columnWidth + endFrac * columnWidth - 2;

  return [
    {
      segmentKey: log.id,
      workLogId: log.id,
      left: Math.max(left, 0),
      width: Math.max(right - left, 4),
    },
  ];
}

/** 주 뷰: 주 컬럼을 7칸(일)으로 나누고, 작업 있는 날만 표시 */
function weekViewSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  const segments: WorkLogBarSegment[] = [];
  const slotWidth = columnWidth / 7;
  const barPad = 1;

  columns.forEach((col, colIndex) => {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dateStr = addDaysStr(col.startDate, dayOffset);
      const dayStart = parseDateTime(`${dateStr}T00:00:00`);
      const dayEnd = parseDateTime(`${addDaysStr(dateStr, 1)}T00:00:00`);

      if (!logOverlapsRange(log.startedAt, log.endedAt, dayStart, dayEnd)) {
        continue;
      }

      segments.push({
        segmentKey: `${log.id}-${col.key}-d${dayOffset}`,
        workLogId: log.id,
        left: colIndex * columnWidth + dayOffset * slotWidth + barPad,
        width: Math.max(slotWidth - barPad * 2, 3),
      });
    }
  });

  return segments;
}

function weeksInMonth(monthStartStr: string, monthEndStr: string) {
  const monthStart = parseDate(monthStartStr);
  const monthEnd = parseDate(monthEndStr);
  let weekStart = startOfWeek(monthStart);
  const weeks: { startDate: string; endDate: string }[] = [];

  while (weekStart <= monthEnd) {
    const weekEnd = endOfWeek(weekStart);
    weeks.push({
      startDate: formatDateStr(weekStart),
      endDate: formatDateStr(weekEnd),
    });
    weekStart = addDays(weekStart, 7);
  }

  return weeks;
}

/** 월 뷰: 월 컬럼을 주 단위 칸으로 나누고, 작업 있는 주만 표시 */
function monthViewSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  const segments: WorkLogBarSegment[] = [];

  columns.forEach((col, colIndex) => {
    const weeks = weeksInMonth(col.startDate, col.endDate);
    const slotWidth = columnWidth / weeks.length;
    const barPad = 1;

    weeks.forEach((week, weekIndex) => {
      const weekStart = parseDateTime(`${week.startDate}T00:00:00`);
      const weekEnd = parseDateTime(`${addDaysStr(week.endDate, 1)}T00:00:00`);

      if (!logOverlapsRange(log.startedAt, log.endedAt, weekStart, weekEnd)) {
        return;
      }

      segments.push({
        segmentKey: `${log.id}-${col.key}-w${weekIndex}`,
        workLogId: log.id,
        left: colIndex * columnWidth + weekIndex * slotWidth + barPad,
        width: Math.max(slotWidth - barPad * 2, 3),
      });
    });
  });

  return segments;
}

export function getWorkLogBarSegments(
  viewMode: ViewMode,
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  if (columns.length === 0) return [];

  if (viewMode === "hour") {
    return hourViewSegments(log, columns, columnWidth);
  }
  if (viewMode === "day") {
    return dayViewSegments(log, columns, columnWidth);
  }
  if (viewMode === "week") {
    return weekViewSegments(log, columns, columnWidth);
  }
  if (viewMode === "month") {
    return monthViewSegments(log, columns, columnWidth);
  }
  return [];
}

export function getAllWorkLogBarSegments(
  viewMode: ViewMode,
  workLogs: WorkLog[],
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  return workLogs.flatMap((log) =>
    getWorkLogBarSegments(viewMode, log, columns, columnWidth),
  );
}

/** hour·day 뷰 드래그 미리보기 → 픽셀 세그먼트 */
export function previewToSegment(
  viewMode: ViewMode,
  startSlot: number,
  endExclusiveSlot: number,
  columnWidth: number,
  key: string,
): WorkLogBarSegment | null {
  if (endExclusiveSlot <= startSlot) return null;

  if (viewMode === "hour") {
    const span = endExclusiveSlot - startSlot;
    return {
      segmentKey: key,
      workLogId: key,
      left: startSlot * columnWidth + 2,
      width: Math.max(span * columnWidth - 4, 4),
      startIndex: startSlot,
      span,
    };
  }

  if (viewMode === "day") {
    const left = slotToPixel(startSlot, columnWidth) + 2;
    const right = slotToPixel(endExclusiveSlot, columnWidth) - 2;
    return {
      segmentKey: key,
      workLogId: key,
      left: Math.max(left, 0),
      width: Math.max(right - left, 4),
    };
  }

  return null;
}

function slotToPixel(slot: number, columnWidth: number): number {
  const col = Math.floor(slot / 24);
  const hour = slot % 24;
  return col * columnWidth + (hour / 24) * columnWidth;
}

/** @deprecated previewToSegment(viewMode, ...) 사용 */
export function previewHourToSegment(
  startIndex: number,
  endIndexExclusive: number,
  columnWidth: number,
  key: string,
): WorkLogBarSegment {
  const span = endIndexExclusive - startIndex;
  return {
    segmentKey: key,
    workLogId: key,
    left: startIndex * columnWidth + 2,
    width: Math.max(span * columnWidth - 4, 4),
    startIndex,
    span,
  };
}
