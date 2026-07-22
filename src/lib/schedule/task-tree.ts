import type { Task } from "@/lib/schedule/types";

export type TaskTreeNode = {
  task: Task;
  children: TaskTreeNode[];
};

export type FlatTreeRow = {
  task: Task;
  depth: number;
  hasChildren: boolean;
};

/** Hierarchy: 형제 간 created_at 오름차순 (sort_order 미사용) */
function compareByCreatedAt(a: Task, b: Task) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function buildTaskTree(tasks: Task[]): TaskTreeNode[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childrenMap = new Map<string | null, Task[]>();

  for (const task of tasks) {
    // 고아 parent는 루트로 취급
    const parentId =
      task.parentId && byId.has(task.parentId) ? task.parentId : null;
    const list = childrenMap.get(parentId) ?? [];
    list.push(task);
    childrenMap.set(parentId, list);
  }

  for (const list of childrenMap.values()) {
    list.sort(compareByCreatedAt);
  }

  function build(parentId: string | null): TaskTreeNode[] {
    return (childrenMap.get(parentId) ?? []).map((task) => ({
      task,
      children: build(task.id),
    }));
  }

  return build(null);
}

/** 접힌 노드의 자손은 제외하고 DFS 평탄화 */
export function flattenVisible(
  roots: TaskTreeNode[],
  collapsedIds: ReadonlySet<string>,
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];

  function walk(nodes: TaskTreeNode[], depth: number) {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      rows.push({ task: node.task, depth, hasChildren });
      if (hasChildren && !collapsedIds.has(node.task.id)) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(roots, 0);
  return rows;
}

/** 필터 매칭 + 조상 유지 (하이라키 맥락) */
export function filterTasksKeepingAncestors(
  tasks: Task[],
  predicate: (task: Task) => boolean,
): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const keep = new Set<string>();

  for (const task of tasks) {
    if (!predicate(task)) continue;
    keep.add(task.id);
    let parentId = task.parentId;
    while (parentId) {
      if (keep.has(parentId)) break;
      keep.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }

  return tasks.filter((t) => keep.has(t.id));
}

/** targetId가 taskId의 자손이면 true (사이클 검사용) */
export function isDescendantOf(
  tasks: Task[],
  taskId: string,
  targetId: string,
): boolean {
  const childrenMap = new Map<string, string[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = childrenMap.get(t.parentId) ?? [];
    list.push(t.id);
    childrenMap.set(t.parentId, list);
  }

  const stack = [...(childrenMap.get(taskId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === targetId) return true;
    const kids = childrenMap.get(id);
    if (kids) stack.push(...kids);
  }
  return false;
}
