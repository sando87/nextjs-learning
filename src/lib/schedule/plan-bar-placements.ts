import type { TimelineColumn } from "./types";

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

function columnRange(col: TimelineColumn): { start: Date; endExclusive: Date } {
  return {
    start: parseDate(col.startDate),
    endExclusive: addDays(parseDate(col.endDate), 1),
  };
}

export type PlanBarPlacement = {
  left: number;
  width: number;
};

/**
 * 계획 일정: startDate 00:00 ~ endDate 다음날 00:00 (종료일 inclusive)
 * 주/월 컬럼 안 실제 일 비율로 left/width 계산
 */
export function getPlanBarPlacement(
  startDate: string | null,
  endDate: string | null,
  columns: TimelineColumn[],
  columnWidth: number,
): PlanBarPlacement | null {
  if (!startDate || !endDate || columns.length === 0) return null;

  const startDt = parseDate(startDate);
  const endExclusiveDt = addDays(parseDate(endDate), 1);

  function dateToPixel(dt: Date): number | null {
    for (let i = 0; i < columns.length; i++) {
      const { start, endExclusive } = columnRange(columns[i]);
      const spanMs = endExclusive.getTime() - start.getTime();
      if (spanMs <= 0) continue;
      if (dt >= start && dt < endExclusive) {
        const frac = (dt.getTime() - start.getTime()) / spanMs;
        return i * columnWidth + frac * columnWidth;
      }
    }
    return null;
  }

  const left = dateToPixel(startDt);
  let right = dateToPixel(endExclusiveDt);

  if (right == null) {
    const lastEnd = columnRange(columns[columns.length - 1]).endExclusive;
    if (endExclusiveDt.getTime() === lastEnd.getTime()) {
      right = columns.length * columnWidth;
    }
  }

  let clippedLeft = left;
  if (clippedLeft == null) {
    const firstStart = columnRange(columns[0]).start;
    if (startDt < firstStart && endExclusiveDt > firstStart) {
      clippedLeft = 0;
    }
  }

  let clippedRight = right;
  if (clippedRight == null) {
    const lastEnd = columnRange(columns[columns.length - 1]).endExclusive;
    if (endExclusiveDt > lastEnd && startDt < lastEnd) {
      clippedRight = columns.length * columnWidth;
    }
  }

  if (clippedLeft == null || clippedRight == null) return null;
  if (clippedRight <= clippedLeft) return null;

  return {
    left: Math.max(clippedLeft + 2, 0),
    width: Math.max(clippedRight - clippedLeft - 4, 4),
  };
}
