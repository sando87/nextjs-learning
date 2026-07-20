export type SortOrderEntry = {
  id: string;
  sortOrder: number;
};

export type SortOrderUpdate = {
  id: string;
  sortOrder: number;
};

const GAP = 10;

/**
 * 보이는 목록의 앞/뒤 이웃 기준으로 sort_order 갱신값을 계산한다.
 * gap이 없으면 low보다 큰 업무들을 GAP 간격으로 renumber한다.
 */
export function computeSortOrderUpdates(
  movedId: string,
  beforeId: string | null,
  afterId: string | null,
  tasks: SortOrderEntry[],
): SortOrderUpdate[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const moved = byId.get(movedId);
  if (!moved) {
    throw new Error("이동할 업무를 찾을 수 없습니다");
  }

  if (beforeId === movedId || afterId === movedId) {
    return [];
  }

  const before = beforeId ? byId.get(beforeId) : null;
  const after = afterId ? byId.get(afterId) : null;

  if (beforeId && !before) {
    throw new Error("앞 이웃 업무를 찾을 수 없습니다");
  }
  if (afterId && !after) {
    throw new Error("뒤 이웃 업무를 찾을 수 없습니다");
  }

  // 끝으로 이동: before + GAP
  if (!after) {
    const low = before?.sortOrder ?? 0;
    const next = low + GAP;
    if (moved.sortOrder === next) return [];
    return [{ id: movedId, sortOrder: next }];
  }

  const low = before?.sortOrder ?? 0;
  const high = after.sortOrder;
  const mid = Math.floor((low + high) / 2);

  if (mid > low && mid < high) {
    if (moved.sortOrder === mid) return [];
    return [{ id: movedId, sortOrder: mid }];
  }

  // gap 없음: sort_order > low 인 업무를 GAP 간격으로 재번호
  const higher = tasks
    .filter((t) => t.sortOrder > low && t.id !== movedId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const updates: SortOrderUpdate[] = [
    { id: movedId, sortOrder: low + GAP },
  ];

  higher.forEach((t, i) => {
    updates.push({ id: t.id, sortOrder: low + GAP * (i + 2) });
  });

  return updates;
}
