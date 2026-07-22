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

export type WorkLogBarSegment = {
  segmentKey: string;
  workLogId: string;
  left: number;
  width: number;
  startIndex?: number;
  span?: number;
};

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

/** 주 뷰: 실제 시작·종료 시각에 맞춘 연속 바 (일 단위 분할 없음) */
function weekViewSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  return continuousRangeSegments(log, columns, columnWidth, (col) => {
    const start = parseDate(col.startDate);
    const endExclusive = addDays(parseDate(col.endDate), 1);
    return { start, endExclusive };
  });
}

/** 월 뷰: 실제 시작·종료 시각에 맞춘 연속 바 (주 단위 분할 없음) */
function monthViewSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  return continuousRangeSegments(log, columns, columnWidth, (col) => {
    const start = parseDate(col.startDate);
    const endExclusive = addDays(parseDate(col.endDate), 1);
    return { start, endExclusive };
  });
}

function continuousRangeSegments(
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
  rangeOf: (col: TimelineColumn) => { start: Date; endExclusive: Date },
): WorkLogBarSegment[] {
  function dateTimeToPixel(dt: Date): number | null {
    for (let i = 0; i < columns.length; i++) {
      const { start, endExclusive } = rangeOf(columns[i]);
      const spanMs = endExclusive.getTime() - start.getTime();
      if (spanMs <= 0) continue;
      if (dt >= start && dt < endExclusive) {
        const frac = (dt.getTime() - start.getTime()) / spanMs;
        return i * columnWidth + frac * columnWidth;
      }
    }
    return null;
  }

  const startDt = parseDateTime(log.startedAt);
  const endDt = parseDateTime(log.endedAt);

  const left = dateTimeToPixel(startDt);
  let right = dateTimeToPixel(endDt);

  if (right == null && columns.length > 0) {
    const lastEnd = rangeOf(columns[columns.length - 1]).endExclusive;
    if (endDt.getTime() === lastEnd.getTime()) {
      right = columns.length * columnWidth;
    }
  }

  let clippedLeft = left;
  if (clippedLeft == null && columns.length > 0) {
    const firstStart = rangeOf(columns[0]).start;
    if (startDt < firstStart && endDt > firstStart) {
      clippedLeft = 0;
    }
  }

  let clippedRight = right;
  if (clippedRight == null && columns.length > 0) {
    const lastEnd = rangeOf(columns[columns.length - 1]).endExclusive;
    if (endDt > lastEnd && startDt < lastEnd) {
      clippedRight = columns.length * columnWidth;
    }
  }

  if (clippedLeft == null || clippedRight == null) return [];
  if (clippedRight <= clippedLeft) return [];

  return [
    {
      segmentKey: log.id,
      workLogId: log.id,
      left: Math.max(clippedLeft + 2, 0),
      width: Math.max(clippedRight - clippedLeft - 4, 4),
    },
  ];
}

export function getWorkLogBarSegments(
  viewMode: ViewMode,
  log: WorkLog,
  columns: TimelineColumn[],
  columnWidth: number,
): WorkLogBarSegment[] {
  if (columns.length === 0) return [];

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

/** day 뷰 드래그 미리보기 → 픽셀 세그먼트 */
export function previewToSegment(
  viewMode: ViewMode,
  startSlot: number,
  endExclusiveSlot: number,
  columnWidth: number,
  key: string,
): WorkLogBarSegment | null {
  if (endExclusiveSlot <= startSlot) return null;

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
