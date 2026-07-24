import type { DayColumnLayout } from "./day-workday-layout";
import { dayHourToPixel, xToDayLayoutIndex } from "./day-workday-layout";
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

/** day=컬럼×24 */
export function getSlotCount(columns: TimelineColumn[], viewMode: ViewMode): number {
  if (viewMode === "day") return columns.length * 24;
  return 0;
}

/** 컬럼 시작 시각 (00:00) */
export function columnStartTimestamp(col: TimelineColumn): string {
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

/** 픽셀 x → 슬롯 인덱스 (day=컬럼×24+시) */
export function xToSlotIndex(
  clientX: number,
  containerLeft: number,
  columnWidth: number,
  columns: TimelineColumn[],
  _viewMode: ViewMode,
  dayLayouts?: DayColumnLayout[],
): number {
  const x = clientX - containerLeft;

  if (dayLayouts && dayLayouts.length > 0) {
    const colIndex = xToDayLayoutIndex(x, dayLayouts);
    const layout = dayLayouts[colIndex];
    const span = Math.max(1, layout.endHour - layout.startHour);
    const fracInCol =
      layout.width > 0
        ? Math.max(0, Math.min(0.9999, (x - layout.offset) / layout.width))
        : 0;
    const hour = Math.max(
      layout.startHour,
      Math.min(
        layout.endHour - 1,
        Math.floor(layout.startHour + fracInCol * span),
      ),
    );
    return colIndex * 24 + hour;
  }

  const colIndex = Math.max(
    0,
    Math.min(columns.length - 1, Math.floor(x / columnWidth)),
  );

  const fracInCol = (x - colIndex * columnWidth) / columnWidth;
  const hour = Math.max(0, Math.min(23, Math.floor(fracInCol * 24)));
  return colIndex * 24 + hour;
}

export function slotsToTimestamps(
  columns: TimelineColumn[],
  startSlot: number,
  endExclusiveSlot: number,
  _viewMode: ViewMode,
): { startedAt: string; endedAt: string } {
  const startCol = Math.floor(startSlot / 24);
  const startHour = startSlot % 24;
  const endCol = Math.floor(endExclusiveSlot / 24);
  const endHour = endExclusiveSlot % 24;

  const startDate = columns[startCol]?.startDate ?? columns[0].startDate;

  // 마지막 날 24시(=다음 날 00:00)는 columns 범위를 한 칸 넘김
  let endedAt: string;
  if (endCol >= columns.length) {
    const last = columns[columns.length - 1];
    endedAt = toHourTimestamp(addDaysStr(last.startDate, 1), 0);
  } else {
    endedAt = toHourTimestamp(columns[endCol].startDate, endHour);
  }

  return {
    startedAt: toHourTimestamp(startDate, startHour),
    endedAt,
  };
}

export type WorkLogSlotRange = {
  startSlot: number;
  endExclusiveSlot: number;
};

/** 헤더에 보이는 날짜별 근무시만 순서대로 (이동 시 야간 공백 건너뛰기용) */
export function buildVisibleHourSlots(
  dayLayouts: DayColumnLayout[],
): number[] {
  const slots: number[] = [];
  dayLayouts.forEach((layout, dayIndex) => {
    for (let h = layout.startHour; h < layout.endHour; h++) {
      slots.push(dayIndex * 24 + h);
    }
  });
  return slots;
}

function closestVisibleIndex(absSlot: number, visible: number[]): number {
  if (visible.length === 0) return 0;
  let best = 0;
  for (let i = 0; i < visible.length; i++) {
    if (visible[i] <= absSlot) best = i;
    else break;
  }
  return best;
}

/**
 * 연속 슬롯 범위를 날짜 컬럼의 표시 근무시로 잘라 날짜당 1구간씩 반환.
 * 예: 9–18 컬럼에서 전날 16시~다음날 11시 → [16–18), [9–11)
 */
export function splitSlotsByDayWorkHours(
  startSlot: number,
  endExclusiveSlot: number,
  dayLayouts: DayColumnLayout[] | undefined,
  columnCount: number,
): WorkLogSlotRange[] {
  if (endExclusiveSlot <= startSlot || columnCount <= 0) return [];

  const startDay = Math.floor(startSlot / 24);
  const endDay = Math.floor((endExclusiveSlot - 1) / 24);
  const segments: WorkLogSlotRange[] = [];

  for (let day = startDay; day <= endDay; day++) {
    if (day < 0 || day >= columnCount) continue;

    const layout = dayLayouts?.[day];
    const dayStartHour = layout?.startHour ?? 0;
    const dayEndHour = layout?.endHour ?? 24;
    const dayMin = day * 24 + dayStartHour;
    const dayMaxExclusive = day * 24 + dayEndHour;

    const segStart = Math.max(startSlot, dayMin);
    const segEnd = Math.min(endExclusiveSlot, dayMaxExclusive);
    if (segEnd > segStart) {
      segments.push({ startSlot: segStart, endExclusiveSlot: segEnd });
    }
  }

  return segments;
}

/** 표시 근무시 기준으로 막대 길이를 유지하며 이동 미리보기 계산 */
export function computeVisibleMoveRange(
  origStart: number,
  origEndExclusive: number,
  anchorSlot: number,
  currentSlot: number,
  dayLayouts: DayColumnLayout[],
): WorkLogSlotRange | null {
  const visible = buildVisibleHourSlots(dayLayouts);
  if (visible.length === 0) return null;

  const origVisible = visible.filter(
    (s) => s >= origStart && s < origEndExclusive,
  );
  const visSpan = Math.max(1, origVisible.length);
  const origStartVis =
    origVisible.length > 0
      ? visible.indexOf(origVisible[0])
      : closestVisibleIndex(origStart, visible);

  const delta =
    closestVisibleIndex(currentSlot, visible) -
    closestVisibleIndex(anchorSlot, visible);
  const newStartVis = Math.max(
    0,
    Math.min(visible.length - visSpan, origStartVis + delta),
  );
  const startSlot = visible[newStartVis];
  const lastSlot = visible[newStartVis + visSpan - 1];
  return { startSlot, endExclusiveSlot: lastSlot + 1 };
}

/** 작업로그 → half-open 슬롯 범위 (day 뷰) */
export function workLogToSlotRange(
  startedAt: string,
  endedAt: string,
  columns: TimelineColumn[],
  viewMode: ViewMode,
): { startSlot: number; endExclusiveSlot: number } | null {
  if (columns.length === 0 || viewMode !== "day") return null;

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

/** 작업로그 → half-open 컬럼 범위 */
export function workLogToColumnRange(
  startedAt: string,
  endedAt: string,
  columns: TimelineColumn[],
): { startIndex: number; endIndexExclusive: number } | null {
  if (columns.length === 0) return null;

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

/** 절대 시 슬롯 → 픽셀 (dayLayouts 있을 때) */
export function slotToPixelWithLayouts(
  slot: number,
  dayLayouts: DayColumnLayout[],
): number {
  const col = Math.floor(slot / 24);
  const hour = slot % 24;
  const layout = dayLayouts[Math.max(0, Math.min(dayLayouts.length - 1, col))];
  if (!layout) return 0;
  return dayHourToPixel(layout, hour);
}
