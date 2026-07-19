import type { TaskStatus } from "@/lib/schedule/types";
import { STATUS_COLORS } from "@/lib/schedule/types";

type GanttBarProps = {
  status: TaskStatus;
  startIndex: number;
  span: number;
  columnWidth: number;
  title?: string;
  /** plan=계획 일정(연한 배경), work=실제 작업시간 */
  variant?: "plan" | "work";
};

export default function GanttBar({
  status,
  startIndex,
  span,
  columnWidth,
  title,
  variant = "work",
}: GanttBarProps) {
  const left = startIndex * columnWidth + 2;
  const width = Math.max(span * columnWidth - 4, 4);
  const isPlan = variant === "plan";

  return (
    <div
      className={`absolute left-0 rounded border ${
        isPlan
          ? "top-1 h-2 border-dashed border-zinc-400 bg-zinc-200/70 dark:border-zinc-500 dark:bg-zinc-700/50"
          : `top-1/2 h-5 -translate-y-1/2 ${STATUS_COLORS[status]}`
      }`}
      style={{ left, width }}
      title={title ?? status}
    />
  );
}
