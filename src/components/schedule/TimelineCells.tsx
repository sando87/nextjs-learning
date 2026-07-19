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

function formatWorkLogTitle(startedAt: string, endedAt: string): string {
  const sameDay = startedAt.slice(0, 10) === endedAt.slice(0, 10);
  if (sameDay) {
    return `${startedAt.slice(5, 10)} ${startedAt.slice(11, 16)}–${endedAt.slice(11, 16)}`;
  }
  return `${startedAt.slice(0, 16)}–${endedAt.slice(0, 16)}`;
}

export default function TimelineCells({
  task,
  columns,
  columnWidth,
  viewMode,
}: TimelineCellsProps) {
  const totalWidth = columns.length * columnWidth;
  const isHourView = viewMode === "hour";

  // 일/주/월에서는 계획 일정도 함께 표시 (작업시간 바와 구분)
  const planSpan =
    !isHourView
      ? getTaskColumnSpan(task.startDate, task.endDate, columns)
      : null;

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

        {planSpan ? (
          <GanttBar
            status={task.status}
            startIndex={planSpan.startIndex}
            span={planSpan.span}
            columnWidth={columnWidth}
            title={`계획 ${task.startDate}–${task.endDate}`}
            variant="plan"
          />
        ) : null}

        {task.workLogs.map((log) => {
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
              title={formatWorkLogTitle(log.startedAt, log.endedAt)}
              variant="work"
            />
          );
        })}
      </div>
    </td>
  );
}
