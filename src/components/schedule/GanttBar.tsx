import type { TaskStatus } from "@/lib/schedule/types";
import { STATUS_COLORS } from "@/lib/schedule/types";

type GanttBarProps = {
  status: TaskStatus;
  startIndex: number;
  span: number;
  columnWidth: number;
};

export default function GanttBar({
  status,
  startIndex,
  span,
  columnWidth,
}: GanttBarProps) {
  const left = startIndex * columnWidth + 4;
  const width = span * columnWidth - 8;

  return (
    <div
      className={`absolute top-1/2 h-5 -translate-y-1/2 rounded border ${STATUS_COLORS[status]}`}
      style={{ left, width }}
      title={status}
    />
  );
}
