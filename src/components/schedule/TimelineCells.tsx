import GanttBar from "@/components/schedule/GanttBar";
import {
  getTaskColumnSpan,
  getWorkLogColumnSpan,
} from "@/lib/schedule/timeline-utils";
import type { Task, TimelineColumn, ViewMode } from "@/lib/schedule/types";

type TimelineCellsProps = {
  task: Task;
  columns: TimelineColumn[];
  columnWidth: number;
  viewMode: ViewMode;
};

export default function TimelineCells({
  task,
  columns,
  columnWidth,
  viewMode,
}: TimelineCellsProps) {
  const totalWidth = columns.length * columnWidth;
  const isHourView = viewMode === "hour";

  return (
    <td
      colSpan={columns.length}
      className="relative border border-zinc-300 p-0 dark:border-zinc-700"
      style={{ width: totalWidth, minWidth: totalWidth, height: 36 }}
    >
      <div className="relative flex h-full" style={{ width: totalWidth }}>
        {columns.map((col) => (
          <div
            key={col.key}
            className={`h-full shrink-0 border-r border-zinc-300 last:border-r-0 dark:border-zinc-700 ${
              isHourView && col.hour === 0
                ? "border-l-2 border-l-zinc-400 dark:border-l-zinc-500"
                : ""
            }`}
            style={{ width: columnWidth }}
          />
        ))}

        {isHourView
          ? task.workLogs.map((log) => {
              const span = getWorkLogColumnSpan(
                log.startedAt,
                log.endedAt,
                columns,
              );
              if (!span) return null;
              return (
                <GanttBar
                  key={log.id}
                  status={task.status}
                  startIndex={span.startIndex}
                  span={span.span}
                  columnWidth={columnWidth}
                  title={`${log.startedAt.slice(0, 16)}–${log.endedAt.slice(11, 16)}`}
                />
              );
            })
          : (() => {
              const span = getTaskColumnSpan(
                task.startDate,
                task.endDate,
                columns,
              );
              if (!span) return null;
              return (
                <GanttBar
                  status={task.status}
                  startIndex={span.startIndex}
                  span={span.span}
                  columnWidth={columnWidth}
                />
              );
            })()}
      </div>
    </td>
  );
}
