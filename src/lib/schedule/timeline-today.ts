import type { DayColumnLayout } from "@/lib/schedule/day-workday-layout";
import type { TimelineColumn, ViewMode } from "@/lib/schedule/types";

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

/** 로컬 타임존 기준 오늘 (YYYY-MM-DD) */
export function localTodayStr(now = new Date()): string {
  return formatDateStr(now);
}

export function columnContainsDate(
  col: TimelineColumn,
  dateStr: string,
): boolean {
  return col.startDate <= dateStr && dateStr <= col.endDate;
}

/** 컬럼 안에서 date가 차지하는 시작 비율·너비 비율 (일 뷰는 종일) */
export function todayBandInColumn(
  col: TimelineColumn,
  today: string,
): { leftFrac: number; widthFrac: number } | null {
  if (!columnContainsDate(col, today)) return null;

  const colStart = parseDate(col.startDate);
  const colEndExclusive = parseDate(col.endDate);
  colEndExclusive.setDate(colEndExclusive.getDate() + 1);
  const totalMs = colEndExclusive.getTime() - colStart.getTime();
  if (totalMs <= 0) return { leftFrac: 0, widthFrac: 1 };

  const dayStart = parseDate(today);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const leftMs = Math.max(0, dayStart.getTime() - colStart.getTime());
  const rightMs = Math.min(
    totalMs,
    dayEnd.getTime() - colStart.getTime(),
  );
  const widthMs = Math.max(0, rightMs - leftMs);
  return {
    leftFrac: leftMs / totalMs,
    widthFrac: widthMs / totalMs,
  };
}

/** 타임라인 콘텐츠 좌측 기준 오늘 시작 x (px) */
export function todayLeftInTimeline(
  columns: TimelineColumn[],
  columnWidth: number,
  today: string,
  dayLayouts?: DayColumnLayout[],
): number | null {
  const index = columns.findIndex((c) => columnContainsDate(c, today));
  if (index < 0) return null;

  const col = columns[index];
  const band = todayBandInColumn(col, today);
  if (!band) return null;

  if (dayLayouts && dayLayouts.length === columns.length) {
    const layout = dayLayouts[index];
    return layout.offset + band.leftFrac * layout.width;
  }

  return index * columnWidth + band.leftFrac * columnWidth;
}

/** 오늘 왼쪽에 보일 여백: 일/주=1칸, 월=차트 1/3 */
function leftPaddingPxBeforeToday(
  viewMode: ViewMode,
  columnWidth: number,
  chartAreaWidth: number,
  todayIndex: number,
  dayLayouts?: DayColumnLayout[],
): number {
  if (viewMode === "month") {
    return chartAreaWidth / 3;
  }

  const colsBefore = 1;
  if (viewMode === "day" && dayLayouts && dayLayouts.length > 0) {
    const from = Math.max(0, todayIndex - colsBefore);
    let width = 0;
    for (let i = from; i < todayIndex; i++) {
      width += dayLayouts[i]?.width ?? columnWidth;
    }
    // 오늘 앞 컬럼이 부족하면 목표 폭으로 보정
    if (todayIndex < colsBefore) {
      return colsBefore * columnWidth;
    }
    return width;
  }

  return colsBefore * columnWidth;
}

/**
 * 오늘이 차트에 오도록 scrollLeft 계산.
 * 일/주: 왼쪽 ~1칸, 월: 차트 1/3.
 */
export function scrollLeftForTodayDefault(
  scrollEl: HTMLElement,
  todayLeftPx: number,
  viewMode: ViewMode,
  columnWidth: number,
  columns: TimelineColumn[],
  today: string,
  dayLayouts?: DayColumnLayout[],
): number {
  const firstTimeline = scrollEl.querySelector(
    "[data-timeline-zoom]",
  ) as HTMLElement | null;
  const rootRect = scrollEl.getBoundingClientRect();
  const metaWidth =
    firstTimeline != null
      ? firstTimeline.getBoundingClientRect().left -
        rootRect.left +
        scrollEl.scrollLeft
      : 0;
  const chartAreaWidth = Math.max(0, scrollEl.clientWidth - metaWidth);
  const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
  const todayIndex = columns.findIndex((c) => columnContainsDate(c, today));
  const pad = leftPaddingPxBeforeToday(
    viewMode,
    columnWidth,
    chartAreaWidth,
    Math.max(0, todayIndex),
    dayLayouts,
  );
  const next = todayLeftPx - pad;
  return Math.max(0, Math.min(maxScroll, next));
}
