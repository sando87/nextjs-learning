import GanttBar from "@/components/schedule/GanttBar";
import { getTaskColumnSpan } from "@/lib/schedule/timeline-utils";
import type { Task, TimelineColumn } from "@/lib/schedule/types";

type TimelineCellsProps = {
  task: Task;
  columns: TimelineColumn[];
  columnWidth: number;
};

export default function TimelineCells({
  task,
  columns,
  columnWidth,
}: TimelineCellsProps) {
  const span = getTaskColumnSpan(task.startDate, task.endDate, columns);
  const totalWidth = columns.length * columnWidth;

  return (
    <td
      colSpan={columns.length}
      className="relative border border-zinc-300 p-0 dark:border-zinc-700"
      style={{ width: totalWidth, minWidth: totalWidth, height: 36 }}
    >
      <div
        className="relative flex h-full"
        style={{ width: totalWidth }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className="h-full shrink-0 border-r border-zinc-300 last:border-r-0 dark:border-zinc-700"
            style={{ width: columnWidth }}
          />
        ))}
        {span ? (
          <GanttBar
            status={task.status}
            startIndex={span.startIndex}
            span={span.span}
            columnWidth={columnWidth}
          />
        ) : null}
      </div>
    </td>
  );
}
