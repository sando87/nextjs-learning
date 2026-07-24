import type { DayColumnLayout } from "@/lib/schedule/day-workday-layout";
import type { TimelineColumn, ViewMode } from "@/lib/schedule/types";
import {
  getDayHourTickStep,
  getDayHourTicksVisible,
  getMonthTickMode,
  getMonthTicks,
  getWeekDayTickVisible,
} from "@/lib/schedule/timeline-utils";

type TimelineHeaderProps = {
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
  dayLayouts?: DayColumnLayout[];
  onExpandEarly?: (date: string) => void;
  onExpandLate?: (date: string) => void;
  onCollapseEarly?: (date: string) => void;
  onCollapseLate?: (date: string) => void;
  sessionExpands?: Record<string, { early: boolean; late: boolean }>;
  /** Replay: 헤더 클릭 시 해당 x로 시점 이동 */
  onSeekClick?: (clientX: number) => void;
};

function DayHourTicks({
  startHour,
  endHour,
  columnWidth,
}: {
  startHour: number;
  endHour: number;
  columnWidth: number;
}) {
  const span = Math.max(1, endHour - startHour);
  const step = getDayHourTickStep(columnWidth);
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h += step) {
    hours.push(h);
  }

  return (
    <div className="relative mt-0.5 h-3.5 border-t border-zinc-300 dark:border-zinc-600">
      {hours.map((hour) => {
        const frac = (hour - startHour) / span;
        return (
          <span
            key={hour}
            className={`absolute top-0.5 text-[9px] leading-none font-normal text-zinc-500 dark:text-zinc-400 ${
              frac === 0 ? "left-0" : "-translate-x-1/2"
            }`}
            style={frac === 0 ? undefined : { left: `${frac * 100}%` }}
          >
            {hour}
          </span>
        );
      })}
    </div>
  );
}

function WeekDayTicks({ startDate }: { startDate: string }) {
  const [y, m, d] = startDate.split("-").map(Number);
  const days: { key: string; label: number; offset: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(y, m - 1, d + i);
    days.push({
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      label: date.getDate(),
      offset: i,
    });
  }

  return (
    <div className="relative mt-0.5 h-3.5 border-t border-zinc-300 dark:border-zinc-600">
      {days.map((day) => (
        <span
          key={day.key}
          className={`absolute top-0.5 text-[9px] leading-none font-normal text-zinc-500 dark:text-zinc-400 ${
            day.offset === 0 ? "left-0" : "-translate-x-1/2"
          }`}
          style={
            day.offset === 0 ? undefined : { left: `${(day.offset / 7) * 100}%` }
          }
        >
          {day.label}
        </span>
      ))}
    </div>
  );
}

function MonthSubTicks({
  startDate,
  endDate,
  mode,
}: {
  startDate: string;
  endDate: string;
  mode: "week" | "day";
}) {
  const ticks = getMonthTicks(startDate, endDate, mode);

  return (
    <div className="relative mt-0.5 h-3.5 border-t border-zinc-300 dark:border-zinc-600">
      {ticks.map((tick) => (
        <span
          key={tick.key}
          className={`absolute top-0.5 text-[9px] leading-none font-normal text-zinc-500 dark:text-zinc-400 ${
            tick.frac === 0 ? "left-0" : "-translate-x-1/2"
          }`}
          style={
            tick.frac === 0 ? undefined : { left: `${tick.frac * 100}%` }
          }
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}

export default function TimelineHeader({
  columns,
  columnWidth,
  viewMode,
  dayLayouts,
  onExpandEarly,
  onExpandLate,
  onCollapseEarly,
  onCollapseLate,
  sessionExpands = {},
  onSeekClick,
}: TimelineHeaderProps) {
  const isDayView = viewMode === "day";
  const isWeekView = viewMode === "week";
  const monthTickMode = viewMode === "month" ? getMonthTickMode(columnWidth) : "none";
  const showWeekTicks = isWeekView && getWeekDayTickVisible(columnWidth);
  const showMonthTicks = monthTickMode !== "none";
  const useStackedHeader = isDayView || showWeekTicks || showMonthTicks;

  return (
    <>
      {columns.map((col, index) => {
        const layout = dayLayouts?.[index];
        const width = isDayView && layout ? layout.width : columnWidth;
        const startHour = layout?.startHour ?? 0;
        const endHour = layout?.endHour ?? 24;
        const session = sessionExpands[col.startDate];
        const headerExpanded = Boolean(session?.early || session?.late);
        const showDayHourTicks =
          isDayView && getDayHourTicksVisible(columnWidth, headerExpanded);
        const canExpandEarly = isDayView && startHour > 0;
        const canExpandLate = isDayView && endHour < 24;
        const canCollapseEarly =
          isDayView && Boolean(session?.early) && startHour === 0;
        const canCollapseLate =
          isDayView && Boolean(session?.late) && endHour === 24;

        return (
          <th
            key={col.key}
            data-timeline-zoom
            className={`border border-zinc-300 bg-zinc-50 px-0.5 text-center font-medium dark:border-zinc-700 dark:bg-zinc-900 ${
              useStackedHeader ? "py-1 text-xs" : "py-2 text-xs"
            } ${onSeekClick ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}`}
            style={{ minWidth: width, width }}
            onClick={
              onSeekClick
                ? (e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    onSeekClick(e.clientX);
                  }
                : undefined
            }
          >
            {isDayView ? (
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center justify-center gap-0.5 leading-tight">
                  {canExpandEarly || canCollapseEarly ? (
                    <button
                      type="button"
                      title={canCollapseEarly ? "이른 오전 접기" : "이른 오전(0시)까지 확장"}
                      className="rounded px-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      onClick={() =>
                        canCollapseEarly
                          ? onCollapseEarly?.(col.startDate)
                          : onExpandEarly?.(col.startDate)
                      }
                    >
                      {canCollapseEarly ? "›" : "‹"}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{col.label}</span>
                  {canExpandLate || canCollapseLate ? (
                    <button
                      type="button"
                      title={canCollapseLate ? "야근 구간 접기" : "야근(24시)까지 확장"}
                      className="rounded px-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      onClick={() =>
                        canCollapseLate
                          ? onCollapseLate?.(col.startDate)
                          : onExpandLate?.(col.startDate)
                      }
                    >
                      {canCollapseLate ? "‹" : "›"}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}
                </div>
                {showDayHourTicks ? (
                  <DayHourTicks
                    startHour={startHour}
                    endHour={endHour}
                    columnWidth={width}
                  />
                ) : null}
              </div>
            ) : showWeekTicks ? (
              <div className="flex flex-col overflow-hidden">
                <span className="leading-tight">{col.label}</span>
                <WeekDayTicks startDate={col.startDate} />
              </div>
            ) : showMonthTicks ? (
              <div className="flex flex-col overflow-hidden">
                <span className="leading-tight">{col.label}</span>
                <MonthSubTicks
                  startDate={col.startDate}
                  endDate={col.endDate}
                  mode={monthTickMode as "week" | "day"}
                />
              </div>
            ) : (
              col.label
            )}
          </th>
        );
      })}
    </>
  );
}
