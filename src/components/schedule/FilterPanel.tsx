"use client";

import type { BoardFilters } from "@/components/schedule/schedule-board-state";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type ProjectMember,
  type Tag,
} from "@/lib/schedule/types";

type FilterPanelProps = {
  filters: BoardFilters;
  members: ProjectMember[];
  tags: Tag[];
  onChange: (filters: BoardFilters) => void;
};

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export default function FilterPanel({
  filters,
  members,
  tags,
  onChange,
}: FilterPanelProps) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        필터
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-64 rounded border border-zinc-200 bg-white p-3 shadow dark:border-zinc-700 dark:bg-zinc-950">
        <p className="mb-1 text-xs font-semibold">담당자</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.userId} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={filters.assigneeIds.includes(m.userId)}
                onChange={() =>
                  onChange({
                    ...filters,
                    assigneeIds: toggleValue(filters.assigneeIds, m.userId),
                  })
                }
              />
              {m.profile.displayName}
            </label>
          ))}
        </div>

        <p className="mb-1 text-xs font-semibold">상태</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {TASK_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={filters.statuses.includes(s)}
                onChange={() =>
                  onChange({
                    ...filters,
                    statuses: toggleValue(filters.statuses, s),
                  })
                }
              />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>

        <p className="mb-1 text-xs font-semibold">태그</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={filters.tagIds.includes(tag.id)}
                onChange={() =>
                  onChange({
                    ...filters,
                    tagIds: toggleValue(filters.tagIds, tag.id),
                  })
                }
              />
              {tag.name}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            onChange({
              assigneeIds: [],
              statuses: [],
              tagIds: [],
            })
          }
          className="mt-3 text-xs text-zinc-500 hover:underline"
        >
          필터 초기화
        </button>
      </div>
    </details>
  );
}
