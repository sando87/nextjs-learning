"use client";

import type { ColumnKey } from "@/components/schedule/schedule-board-state";
import { COLUMN_LABELS } from "@/components/schedule/schedule-board-state";

type ColumnVisibilityMenuProps = {
  visibleColumns: Record<ColumnKey, boolean>;
  onToggle: (key: ColumnKey) => void;
};

export default function ColumnVisibilityMenu({
  visibleColumns,
  onToggle,
}: ColumnVisibilityMenuProps) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        열 표시
      </summary>
      <div className="absolute left-0 z-20 mt-1 min-w-[160px] rounded border border-zinc-200 bg-white p-2 shadow dark:border-zinc-700 dark:bg-zinc-950">
        {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <input
              type="checkbox"
              checked={visibleColumns[key]}
              onChange={() => onToggle(key)}
            />
            {COLUMN_LABELS[key]}
          </label>
        ))}
      </div>
    </details>
  );
}
