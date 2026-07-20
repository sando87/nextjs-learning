import type { BoardFilters, SortKey } from "@/components/schedule/schedule-board-state";
import type { Task } from "@/lib/schedule/types";

export const VALID_SORT_KEYS: SortKey[] = [
  "sortOrder",
  "priority",
  "startDate",
  "status",
  "title",
];

export function resolveSortKey(saved?: SortKey): SortKey {
  if (saved && VALID_SORT_KEYS.includes(saved)) return saved;
  return "sortOrder";
}

export function applyFilters(tasks: Task[], filters: BoardFilters) {
  return tasks.filter((task) => {
    if (
      filters.assigneeIds.length > 0 &&
      (!task.assigneeId || !filters.assigneeIds.includes(task.assigneeId))
    ) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }
    if (
      filters.tagIds.length > 0 &&
      !task.tags.some((t) => filters.tagIds.includes(t.id))
    ) {
      return false;
    }
    return true;
  });
}

export function sortTasks(tasks: Task[], sortKey: SortKey) {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (sortKey === "sortOrder") {
      return a.sortOrder - b.sortOrder || a.priority - b.priority;
    }
    if (sortKey === "priority") return a.priority - b.priority;
    if (sortKey === "title") return a.title.localeCompare(b.title);
    if (sortKey === "status") return a.status.localeCompare(b.status);
    const aDate = a.startDate ?? "9999-99-99";
    const bDate = b.startDate ?? "9999-99-99";
    return aDate.localeCompare(bDate);
  });
  return copy;
}

/** 드롭 위치(insertIndex in without-moved list) 기준 앞/뒤 이웃 */
export function neighborsAtInsert(
  visible: Task[],
  movedId: string,
  insertIndex: number,
): { beforeId: string | null; afterId: string | null } {
  const without = visible.filter((t) => t.id !== movedId);
  const clamped = Math.max(0, Math.min(insertIndex, without.length));
  return {
    beforeId: clamped > 0 ? without[clamped - 1].id : null,
    afterId: clamped < without.length ? without[clamped].id : null,
  };
}

/** row index + before/after → moved 제외 목록의 insertIndex */
export function toInsertIndex(
  visible: Task[],
  draggingId: string | null,
  rowIndex: number,
  placeBefore: boolean,
) {
  let insertAt = placeBefore ? rowIndex : rowIndex + 1;
  const from = visible.findIndex((t) => t.id === draggingId);
  if (from >= 0 && from < insertAt) insertAt -= 1;
  return insertAt;
}

function toVisualInsertIndex(
  visible: Task[],
  draggingId: string | null,
  dropInsertIndex: number,
) {
  const from = visible.findIndex((t) => t.id === draggingId);
  let visualIndex = dropInsertIndex;
  if (from >= 0 && from < dropInsertIndex) visualIndex += 1;
  return visualIndex;
}

export function showIndicatorAbove(
  visible: Task[],
  draggingId: string | null,
  dropInsertIndex: number | null,
  rowIndex: number,
) {
  if (dropInsertIndex === null || !draggingId) return false;
  return (
    toVisualInsertIndex(visible, draggingId, dropInsertIndex) === rowIndex
  );
}

/** 맨 끝 삽입: 마지막 행 아래에 표시 */
export function showIndicatorBelow(
  visible: Task[],
  draggingId: string | null,
  dropInsertIndex: number | null,
  rowIndex: number,
) {
  if (dropInsertIndex === null || !draggingId || visible.length === 0) {
    return false;
  }
  const visualIndex = toVisualInsertIndex(
    visible,
    draggingId,
    dropInsertIndex,
  );
  return visualIndex === visible.length && rowIndex === visible.length - 1;
}
