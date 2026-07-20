import type { TimelineColumn, ViewMode } from "./types";

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseDateTime(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  const [datePart, timePart = "00:00:00"] = normalized.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm = "0", ss = "0"] = timePart.split(":");
  return new Date(y, m - 1, d, Number(hh), Number(mm), Number(ss));
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toHourTimestamp(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:00:00`;
}

/** hour=컬럼 수, day=컬럼×24 */
export function getSlotCount(columns: TimelineColumn[], viewMode: ViewMode): number {
  if (viewMode === "hour") return columns.length;
  if (viewMode === "day") return columns.length * 24;
  return 0;
}

/** 컬럼 시작 시각 (hour 뷰=해당 시, 일/주/월=00:00) */
export function columnStartTimestamp(col: TimelineColumn): string {
  if (col.hour !== undefined) {
    return `${col.startDate}T${String(col.hour).padStart(2, "0")}:00:00`;
  }
  return `${col.startDate}T00:00:00`;
}

/** half-open 구간의 종료 시각 (endIndexExclusive 컬럼의 시작) */
export function columnEndExclusiveTimestamp(
  columns: TimelineColumn[],
  endIndexExclusive: number,
): string {
  if (endIndexExclusive < columns.length) {
    return columnStartTimestamp(columns[endIndexExclusive]);
  }

  const last = columns[columns.length - 1];
  if (last.hour !== undefined) {
    if (last.hour < 23) {
      return `${last.startDate}T${String(last.hour + 1).padStart(2, "0")}:00:00`;
    }
    return `${addDaysStr(last.startDate, 1)}T00:00:00`;
  }
  return `${addDaysStr(last.endDate, 1)}T00:00:00`;
}

export function indicesToTimestamps(
  columns: TimelineColumn[],
  startIndex: number,
  endIndexExclusive: number,
): { startedAt: string; endedAt: string } {
  return {
    startedAt: columnStartTimestamp(columns[startIndex]),
    endedAt: columnEndExclusiveTimestamp(columns, endIndexExclusive),
  };
}

/** 픽셀 x → 슬롯 인덱스 (hour=컬럼, day=컬럼×24+시) */
export function xToSlotIndex(
  clientX: number,
  containerLeft: number,
  columnWidth: number,
  columns: TimelineColumn[],
  viewMode: ViewMode,
): number {
  const x = clientX - containerLeft;
  const colIndex = Math.max(
    0,
    Math.min(columns.length - 1, Math.floor(x / columnWidth)),
  );

  if (viewMode === "hour") {
    return colIndex;
  }

  const fracInCol = (x - colIndex * columnWidth) / columnWidth;
  const hour = Math.max(0, Math.min(23, Math.floor(fracInCol * 24)));
  return colIndex * 24 + hour;
}

/** @deprecated hour 뷰 호환 */
export function xToColumnIndex(
  clientX: number,
  containerLeft: number,
  columnWidth: number,
  columnCount: number,
): number {
  const x = clientX - containerLeft;
  return Math.max(0, Math.min(columnCount - 1, Math.floor(x / columnWidth)));
}

export function slotsToTimestamps(
  columns: TimelineColumn[],
  startSlot: number,
  endExclusiveSlot: number,
  viewMode: ViewMode,
): { startedAt: string; endedAt: string } {
  if (viewMode === "hour") {
    return indicesToTimestamps(columns, startSlot, endExclusiveSlot);
  }

  const startCol = Math.floor(startSlot / 24);
  const startHour = startSlot % 24;
  const endCol = Math.floor(endExclusiveSlot / 24);
  const endHour = endExclusiveSlot % 24;

  const startDate = columns[startCol]?.startDate ?? columns[0].startDate;
  const endDate =
    columns[endCol]?.startDate ?? columns[columns.length - 1].startDate;

  return {
    startedAt: toHourTimestamp(startDate, startHour),
    endedAt: toHourTimestamp(endDate, endHour),
  };
}

/** 작업로그 → half-open 슬롯 범위 (hour·day 뷰) */
export function workLogToSlotRange(
  startedAt: string,
  endedAt: string,
  columns: TimelineColumn[],
  viewMode: ViewMode,
): { startSlot: number; endExclusiveSlot: number } | null {
  if (columns.length === 0) return null;

  if (viewMode === "hour") {
    const range = workLogToColumnRange(startedAt, endedAt, columns);
    if (!range) return null;
    return {
      startSlot: range.startIndex,
      endExclusiveSlot: range.endIndexExclusive,
    };
  }

  if (viewMode === "day") {
    const start = parseDateTime(startedAt);
    const end = parseDateTime(endedAt);
    const startCol = columns.findIndex(
      (c) => c.startDate === formatDateStr(start),
    );
    if (startCol === -1) return null;

    let endExclusiveSlot: number;
    if (
      end.getHours() === 0 &&
      end.getMinutes() === 0 &&
      end.getSeconds() === 0
    ) {
      const midnightCol = columns.findIndex(
        (c) => c.startDate === formatDateStr(end),
      );
      if (midnightCol === -1) return null;
      endExclusiveSlot = midnightCol * 24;
    } else {
      const endCol = columns.findIndex(
        (c) => c.startDate === formatDateStr(end),
      );
      if (endCol === -1) return null;
      endExclusiveSlot = endCol * 24 + end.getHours();
    }

    return {
      startSlot: startCol * 24 + start.getHours(),
      endExclusiveSlot,
    };
  }

  return null;
}

/** 작업로그 → half-open 컬럼 범위 */
export function workLogToColumnRange(
  startedAt: string,
  endedAt: string,
  columns: TimelineColumn[],
): { startIndex: number; endIndexExclusive: number } | null {
  if (columns.length === 0) return null;

  if (columns[0].hour !== undefined) {
    const start = new Date(startedAt.replace(" ", "T"));
    const end = new Date(endedAt.replace(" ", "T"));

    let startIndex = -1;
    let endIndex = -1;

    columns.forEach((col, index) => {
      const [y, m, d] = col.startDate.split("-").map(Number);
      const colStart = new Date(y, m - 1, d, col.hour ?? 0, 0, 0);
      const colEnd = new Date(colStart.getTime() + 60 * 60 * 1000);
      if (start < colEnd && end > colStart) {
        if (startIndex === -1) startIndex = index;
        endIndex = index;
      }
    });

    if (startIndex === -1) return null;
    return { startIndex, endIndexExclusive: endIndex + 1 };
  }

  const startDate = startedAt.slice(0, 10);
  let endDay = endedAt.slice(0, 10);
  const endTime = endedAt.slice(11);
  if (endTime === "00:00:00") {
    endDay = addDaysStr(endDay, -1);
  }

  let startIndex = -1;
  let endIndex = -1;

  columns.forEach((col, index) => {
    if (startDate <= col.endDate && endDay >= col.startDate) {
      if (startIndex === -1) startIndex = index;
      endIndex = index;
    }
  });

  if (startIndex === -1) return null;
  return { startIndex, endIndexExclusive: endIndex + 1 };
}

/** 시작·끝이 같거나 역전이면 삭제 대상 */
export function shouldDeleteWorkLog(startedAt: string, endedAt: string): boolean {
  return endedAt <= startedAt;
}
