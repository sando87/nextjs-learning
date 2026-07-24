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

function earliestBound(
  taskStartDates: (string | null)[],
  workLogStartAts: string[],
): Date | null {
  const dates = [
    ...taskStartDates.filter((d): d is string => d !== null).map(parseDate),
    ...workLogStartAts.map((v) => parseDateTime(v)),
  ];
  if (dates.length === 0) return null;
  return dates.sort((a, b) => a.getTime() - b.getTime())[0];
}

/** 뷰 단위로 날짜를 N칸 이동 */
export function shiftDateByColumns(
  dateStr: string,
  viewMode: ViewMode,
  columns: number,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (viewMode === "day") {
    return formatDateStr(new Date(y, m - 1, d + columns));
  }
  if (viewMode === "week") {
    return formatDateStr(new Date(y, m - 1, d + columns * 7));
  }
  return formatDateStr(new Date(y, m - 1 + columns, d));
}

/** 버튼으로 과거/미래 컬럼 추가 시 칸 수 (일=7일, 주=7주, 월=7개월) */
export const TIMELINE_EXTEND_COLUMNS = 7;

/** 오늘 기준 초기 과거 패딩 (1/3 스크롤용, 업무 없어도) */
export const TIMELINE_INITIAL_PAST_PADDING: Record<ViewMode, number> = {
  day: 7,
  week: 2,
  month: 1,
};

export type ScheduleDateBounds = {
  startDate: string;
  endDate: string;
};

/**
 * 업무·작업로그·오늘을 반영한 일정 날짜 범위.
 * 프로젝트 시작일과 무관.
 */
export function collectScheduleDateBounds(
  taskStartDates: (string | null)[],
  taskEndDates: (string | null)[],
  workLogStartAts: string[],
  workLogEndAts: string[],
  today: string,
): ScheduleDateBounds {
  // 시작/종료 모두 양쪽에 반영 (한쪽만 있는 업무 포함)
  const earliest = earliestBound(
    [...taskStartDates, ...taskEndDates],
    workLogStartAts,
  );
  const latest = latestBound(
    [...taskStartDates, ...taskEndDates],
    workLogEndAts,
  );
  const todayDate = parseDate(today);

  let start = earliest ?? todayDate;
  let end = latest ?? todayDate;
  if (todayDate < start) start = todayDate;
  if (todayDate > end) end = todayDate;

  return {
    startDate: formatDateStr(start),
    endDate: formatDateStr(end),
  };
}


/** 일 셀 너비에 따른 시간 눈금 간격 (시). 6시간 단계는 쓰지 않음 */
export function getDayHourTickStep(columnWidth: number): 1 | 3 {
  if (columnWidth >= 288) return 1;
  return 3;
}

/** 최대 줌 아웃에서는 시 눈금 숨김 */
export function getDayHourTicksVisible(dayColumnWidth: number): boolean {
  return dayColumnWidth > 72;
}

/** 주 셀이 충분히 넓을 때만 하단 요일 날짜 눈금 표시 */
export function getWeekDayTickVisible(columnWidth: number): boolean {
  return columnWidth >= 140;
}

export type MonthTickMode = "none" | "week" | "day";

/** 월 셀 너비에 따라 하단 눈금: 없음 / 주 / 일 */
export function getMonthTickMode(columnWidth: number): MonthTickMode {
  if (columnWidth >= 360) return "day";
  if (columnWidth >= 160) return "week";
  return "none";
}

export type MonthTick = {
  key: string;
  label: string;
  /** 0–1, 월 시작 기준 비율 */
  frac: number;
};

/** 월 컬럼 하단·가이드용 눈금 위치 */
export function getMonthTicks(
  startDate: string,
  endDate: string,
  mode: "week" | "day",
): MonthTick[] {
  const monthStart = parseDate(startDate);
  const monthEnd = parseDate(endDate);
  const monthEndExclusive = addDays(monthEnd, 1);
  const monthMs = monthEndExclusive.getTime() - monthStart.getTime();
  if (monthMs <= 0) return [];

  if (mode === "day") {
    const ticks: MonthTick[] = [];
    const days = monthEnd.getDate();
    for (let d = 1; d <= days; d++) {
      const dt = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      ticks.push({
        key: formatDateStr(dt),
        label: String(d),
        frac: (dt.getTime() - monthStart.getTime()) / monthMs,
      });
    }
    return ticks;
  }

  const ticks: MonthTick[] = [];
  let ws = startOfWeek(monthStart);
  while (ws <= monthEnd) {
    const we = endOfWeek(ws);
    if (we >= monthStart) {
      const tickDate = ws < monthStart ? monthStart : ws;
      ticks.push({
        key: formatDateStr(tickDate),
        label: String(tickDate.getDate()),
        frac: (tickDate.getTime() - monthStart.getTime()) / monthMs,
      });
    }
    ws = addDays(ws, 7);
  }
  return ticks;
}

export function generateTimelineColumns(
  viewMode: ViewMode,
  rangeStartDate: string,
  rangeEndDate: string,
  minCount = 14,
): TimelineColumn[] {
  const start = parseDate(rangeStartDate);
  const end = parseDate(rangeEndDate);

  if (viewMode === "day") {
    const columns: TimelineColumn[] = [];
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const count = Math.max(minCount, Math.max(1, days));

    for (let i = 0; i < count; i++) {
      const day = addDays(start, i);
      columns.push({
        key: formatDateStr(day),
        label: `${day.getMonth() + 1}/${day.getDate()}`,
        startDate: formatDateStr(day),
        endDate: formatDateStr(day),
      });
    }
    return columns;
  }

  if (viewMode === "week") {
    const columns: TimelineColumn[] = [];
    const weekStart = startOfWeek(start);
    const weeks =
      Math.ceil(
        (end.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24 * 7),
      ) + 1;
    const count = Math.max(minCount, Math.max(1, weeks));

    for (let i = 0; i < count; i++) {
      const ws = addDays(weekStart, i * 7);
      const we = endOfWeek(ws);
      const startLabel = `${ws.getMonth() + 1}/${ws.getDate()}`;
      // 같은 달이면 끝은 일만 (7/13~19), 월이 바뀌면 월/일 (7/28~8/3)
      const endLabel =
        ws.getMonth() === we.getMonth() && ws.getFullYear() === we.getFullYear()
          ? String(we.getDate())
          : `${we.getMonth() + 1}/${we.getDate()}`;
      columns.push({
        key: `week-${formatDateStr(ws)}`,
        label: `${startLabel}~${endLabel}`,
        startDate: formatDateStr(ws),
        endDate: formatDateStr(we),
      });
    }
    return columns;
  }

  const columns: TimelineColumn[] = [];
  const monthStart = startOfMonth(start);
  const months =
    (end.getFullYear() - monthStart.getFullYear()) * 12 +
    (end.getMonth() - monthStart.getMonth()) +
    1;
  const count = Math.max(minCount, Math.max(1, months));

  for (let i = 0; i < count; i++) {
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

/** 작업로그가 걸친 실제 날짜 구간 (ended_at 정시는 전날까지) */
export function workLogDateRange(
  startedAt: string,
  endedAt: string,
): { startDate: string; endDate: string } {
  const start = parseDateTime(startedAt);
  const end = parseDateTime(endedAt);
  const startDate = formatDateStr(start);

  let endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0
  ) {
    endDay = addDays(endDay, -1);
  }
  const endDate = formatDateStr(endDay < start ? start : endDay);
  return { startDate, endDate };
}

/** 일/주/월 뷰: 작업이 걸친 날짜가 포함된 컬럼 */
export function getWorkLogColumnSpan(
  startedAt: string,
  endedAt: string,
  columns: TimelineColumn[],
): { startIndex: number; span: number } | null {
  if (columns.length === 0) return null;
  const { startDate, endDate } = workLogDateRange(startedAt, endedAt);
  return getTaskColumnSpan(startDate, endDate, columns);
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
