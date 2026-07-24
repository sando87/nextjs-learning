import type { ViewMode } from "./types";

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 로컬 자정 기준 일수 차이 (target - origin) */
function dayDiff(origin: Date, target: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - origin.getTime()) / msPerDay);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * 프로젝트 시작일 기준 상대 오프셋.
 * 같은 날/주/월이면 0, 이전이면 음수.
 */
export function relativeTimelineOffset(
  viewMode: ViewMode,
  columnStartDate: string,
  projectStartDate: string,
): number {
  const col = parseDate(columnStartDate);
  const start = parseDate(projectStartDate);

  if (viewMode === "day") {
    return dayDiff(start, col);
  }

  if (viewMode === "week") {
    return Math.round(dayDiff(startOfWeek(start), startOfWeek(col)) / 7);
  }

  return (
    (col.getFullYear() - start.getFullYear()) * 12 +
    (col.getMonth() - start.getMonth())
  );
}

/** 예: 0Day, 1Week, -2Month */
export function formatRelativeColumnLabel(
  viewMode: ViewMode,
  columnStartDate: string,
  projectStartDate: string,
): string {
  const offset = relativeTimelineOffset(
    viewMode,
    columnStartDate,
    projectStartDate,
  );
  const unit =
    viewMode === "day" ? "Day" : viewMode === "week" ? "Week" : "Month";
  return `${offset}${unit}`;
}
