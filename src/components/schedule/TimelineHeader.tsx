import type { TimelineColumn } from "@/lib/schedule/types";

type TimelineHeaderProps = {
  columns: TimelineColumn[];
  columnWidth: number;
};

export default function TimelineHeader({
  columns,
  columnWidth,
}: TimelineHeaderProps) {
  return (
    <>
      {columns.map((col) => (
        <th
          key={col.key}
          className="border border-zinc-300 bg-zinc-50 px-1 py-2 text-center text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
          style={{ minWidth: columnWidth, width: columnWidth }}
        >
          {col.label}
        </th>
      ))}
    </>
  );
}
