import type { TimelineColumn, WorkLog } from "./types";
import {
  DEFAULT_WORKDAY_END_HOUR,
  DEFAULT_WORKDAY_START_HOUR,
} from "./types";

export type DaySessionExpand = {
  /** 헤더로 0시까지 확장 */
  early: boolean;
  /** 헤더로 24시까지 확장 */
  late: boolean;
};

export type DayColumnLayout = {
  date: string;
  startHour: number;
  endHour: number;
  width: number;
  offset: number;
};

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseHour(ts: string): number {
  return Number(ts.slice(11, 13));
}

/** 로그가 해당 날짜에 덮는 half-open 시 구간 (없으면 null) */
export function workLogHoursOnDay(
  date: string,
  startedAt: string,
  endedAt: string,
): { startHour: number; endHour: number } | null {
  const dayStart = `${date}T00:00:00`;
  const nextDay = addDaysStr(date, 1);
  const dayEnd = `${nextDay}T00:00:00`;

  const start = startedAt > dayStart ? startedAt : dayStart;
  const end = endedAt < dayEnd ? endedAt : dayEnd;
  if (end <= start) return null;

  const startHour = start.slice(0, 10) === date ? parseHour(start) : 0;
  const endHour = end === dayEnd ? 24 : parseHour(end);
  if (endHour <= startHour) return null;
  return { startHour, endHour };
}

export function resolveDayVisibleRange(
  date: string,
  workLogs: WorkLog[],
  workdayStartHour: number,
  workdayEndHour: number,
  session?: DaySessionExpand,
): { startHour: number; endHour: number } {
  let start = workdayStartHour;
  let end = workdayEndHour;

  for (const log of workLogs) {
    const covered = workLogHoursOnDay(date, log.startedAt, log.endedAt);
    if (!covered) continue;
    start = Math.min(start, covered.startHour);
    end = Math.max(end, covered.endHour);
  }

  if (session?.early) start = 0;
  if (session?.late) end = 24;

  start = Math.max(0, Math.min(23, start));
  end = Math.max(start + 1, Math.min(24, end));
  return { startHour: start, endHour: end };
}

export function hourPxFromDayColumnWidth(
  dayColumnWidth: number,
  workdayStartHour: number,
  workdayEndHour: number,
): number {
  const span = Math.max(1, workdayEndHour - workdayStartHour);
  return dayColumnWidth / span;
}

/** 일 뷰: 날짜별 너비·누적 offset */
export function buildDayColumnLayouts(
  columns: TimelineColumn[],
  workLogs: WorkLog[],
  dayColumnWidth: number,
  workdayStartHour = DEFAULT_WORKDAY_START_HOUR,
  workdayEndHour = DEFAULT_WORKDAY_END_HOUR,
  sessionExpands: Record<string, DaySessionExpand> = {},
): DayColumnLayout[] {
  const hourPx = hourPxFromDayColumnWidth(
    dayColumnWidth,
    workdayStartHour,
    workdayEndHour,
  );

  let offset = 0;
  return columns.map((col) => {
    const date = col.startDate;
    const { startHour, endHour } = resolveDayVisibleRange(
      date,
      workLogs,
      workdayStartHour,
      workdayEndHour,
      sessionExpands[date],
    );
    const span = endHour - startHour;
    const width = hourPx * span;
    const layout: DayColumnLayout = {
      date,
      startHour,
      endHour,
      width,
      offset,
    };
    offset += width;
    return layout;
  });
}

export function totalDayLayoutsWidth(layouts: DayColumnLayout[]): number {
  if (layouts.length === 0) return 0;
  const last = layouts[layouts.length - 1];
  return last.offset + last.width;
}

/** x(컨테이너 기준) → 날짜 레이아웃 인덱스 */
export function xToDayLayoutIndex(
  x: number,
  layouts: DayColumnLayout[],
): number {
  if (layouts.length === 0) return 0;
  if (x <= 0) return 0;
  for (let i = 0; i < layouts.length; i++) {
    const right = layouts[i].offset + layouts[i].width;
    if (x < right) return i;
  }
  return layouts.length - 1;
}

/** 컬럼 안 절대 시 → 픽셀 (컨테이너 좌측 기준) */
export function dayHourToPixel(
  layout: DayColumnLayout,
  hour: number,
): number {
  const span = layout.endHour - layout.startHour;
  if (span <= 0) return layout.offset;
  const clamped = Math.max(layout.startHour, Math.min(layout.endHour, hour));
  return layout.offset + ((clamped - layout.startHour) / span) * layout.width;
}
