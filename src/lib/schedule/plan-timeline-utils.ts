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

function daysInColumn(col: TimelineColumn): number {
  const start = parseDate(col.startDate);
  const end = parseDate(col.endDate);
  return (
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
}

/** 타임라인에 나타난 달력 일 목록 (주=7일×N, 월=월별 일수 합) */
export function buildPlanDaySlots(columns: TimelineColumn[]): string[] {
  const dates: string[] = [];
  for (const col of columns) {
    let d = parseDate(col.startDate);
    const end = parseDate(col.endDate);
    while (d <= end) {
      dates.push(formatDateStr(d));
      d = addDays(d, 1);
    }
  }
  return dates;
}

export function getPlanDaySlotCount(columns: TimelineColumn[]): number {
  return buildPlanDaySlots(columns).length;
}

export function xToPlanDaySlot(
  clientX: number,
  containerLeft: number,
  columnWidth: number,
  columns: TimelineColumn[],
): number {
  if (columns.length === 0) return 0;

  const x = clientX - containerLeft;
  const colIndex = Math.max(
    0,
    Math.min(columns.length - 1, Math.floor(x / columnWidth)),
  );
  const fracInCol = Math.max(
    0,
    Math.min(0.9999, (x - colIndex * columnWidth) / columnWidth),
  );

  let slotBase = 0;
  for (let i = 0; i < colIndex; i++) {
    slotBase += daysInColumn(columns[i]);
  }
  const n = daysInColumn(columns[colIndex]);
  const dayInCol = Math.max(0, Math.min(n - 1, Math.floor(fracInCol * n)));
  return slotBase + dayInCol;
}

export function planSlotsToDates(
  columns: TimelineColumn[],
  startSlot: number,
  endExclusiveSlot: number,
): { startDate: string; endDate: string } | null {
  const slots = buildPlanDaySlots(columns);
  if (slots.length === 0) return null;

  const start = Math.max(0, Math.min(slots.length - 1, startSlot));
  const endEx = Math.max(start + 1, Math.min(slots.length, endExclusiveSlot));
  return {
    startDate: slots[start],
    endDate: slots[endEx - 1],
  };
}

export function datesToPlanSlotRange(
  startDate: string,
  endDate: string,
  columns: TimelineColumn[],
): { startSlot: number; endExclusiveSlot: number } | null {
  const slots = buildPlanDaySlots(columns);
  if (slots.length === 0) return null;

  let startSlot = slots.indexOf(startDate);
  if (startSlot === -1) {
    startSlot = slots.findIndex((d) => d >= startDate);
    if (startSlot === -1) return null;
  }

  let endSlot = slots.indexOf(endDate);
  if (endSlot === -1) {
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] <= endDate) {
        endSlot = i;
        break;
      }
    }
    if (endSlot === -1) return null;
  }

  if (endSlot < startSlot) return null;
  return { startSlot, endExclusiveSlot: endSlot + 1 };
}
