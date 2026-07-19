import type { TimelineColumn } from "@/lib/schedule/types";

type TimelineHeaderProps = {
  columns: TimelineColumn[];
  columnWidth: number;
};

export default function TimelineHeader({
  columns,
  columnWidth,
}: TimelineHeaderProps) {
  const isHourView = columns[0]?.hour !== undefined;

  return (
    <>
      {columns.map((col) => (
        <th
          key={col.key}
          className={`border border-zinc-300 bg-zinc-50 px-0.5 py-2 text-center font-medium dark:border-zinc-700 dark:bg-zinc-900 ${
            isHourView ? "text-[10px]" : "text-xs"
          } ${
            isHourView && col.hour === 0
              ? "border-l-2 border-l-zinc-400 dark:border-l-zinc-500"
              : ""
          }`}
          style={{ minWidth: columnWidth, width: columnWidth }}
        >
          {col.label}
        </th>
      ))}
    </>
  );
}
