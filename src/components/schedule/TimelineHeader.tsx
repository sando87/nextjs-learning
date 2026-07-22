import type { TimelineColumn, ViewMode } from "@/lib/schedule/types";
import {
  getDayHourTickStep,
  getMonthTickMode,
  getMonthTicks,
  getWeekDayTickVisible,
} from "@/lib/schedule/timeline-utils";

type TimelineHeaderProps = {
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
};

function DayHourTicks({ columnWidth }: { columnWidth: number }) {
  const step = getDayHourTickStep(columnWidth);
  const hours: number[] = [];
  for (let h = 0; h < 24; h += step) {
    hours.push(h);
  }

  return (
    <div className="relative mt-0.5 h-3.5 border-t border-zinc-300 dark:border-zinc-600">
      {hours.map((hour) => (
        <span
          key={hour}
          className={`absolute top-0.5 text-[9px] leading-none font-normal text-zinc-500 dark:text-zinc-400 ${
            hour === 0 ? "left-0" : "-translate-x-1/2"
          }`}
          style={hour === 0 ? undefined : { left: `${(hour / 24) * 100}%` }}
        >
          {hour}
        </span>
      ))}
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
}: TimelineHeaderProps) {
  const isDayView = viewMode === "day";
  const isWeekView = viewMode === "week";
  const monthTickMode = viewMode === "month" ? getMonthTickMode(columnWidth) : "none";
  const showWeekTicks = isWeekView && getWeekDayTickVisible(columnWidth);
  const showMonthTicks = monthTickMode !== "none";
  const useStackedHeader = isDayView || showWeekTicks || showMonthTicks;

  return (
    <>
      {columns.map((col) => (
        <th
          key={col.key}
          data-timeline-zoom
          className={`border border-zinc-300 bg-zinc-50 px-0.5 text-center font-medium dark:border-zinc-700 dark:bg-zinc-900 ${
            useStackedHeader ? "py-1 text-xs" : "py-2 text-xs"
          }`}
          style={{ minWidth: columnWidth, width: columnWidth }}
        >
          {isDayView ? (
            <div className="flex flex-col overflow-hidden">
              <span className="leading-tight">{col.label}</span>
              <DayHourTicks columnWidth={columnWidth} />
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
      ))}
    </>
  );
}
