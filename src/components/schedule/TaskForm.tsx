"use client";

import {
  createTaskAction,
  deleteTaskAction,
  setTaskTagsAction,
  updateTaskAction,
} from "@/app/schedule/actions";
import WorkLogSection from "@/components/schedule/WorkLogSection";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type ProjectMember,
  type Tag,
  type Task,
} from "@/lib/schedule/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TaskFormProps = {
  projectId: string;
  members: ProjectMember[];
  tags: Tag[];
  task: Task | null;
  onClose: () => void;
};

export default function TaskForm({
  projectId,
  members,
  tags,
  task,
  onClose,
}: TaskFormProps) {
  const router = useRouter();
  const isEdit = task !== null;
  const [selectedTags, setSelectedTags] = useState<string[]>(
    task?.tags.map((t) => t.id) ?? [],
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      if (isEdit && task) {
        await updateTaskAction(fd);

        const tagFd = new FormData();
        tagFd.set("projectId", projectId);
        tagFd.set("taskId", task.id);
        selectedTags.forEach((id) => tagFd.append("tagIds", id));
        await setTaskTagsAction(tagFd);
      } else {
        await createTaskAction(fd);
      }

      router.refresh();
      onClose();
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setPending(true);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", task.id);
    await deleteTaskAction(fd);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">
          {isEdit ? "업무 수정" : "업무 추가"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          {isEdit ? <input type="hidden" name="taskId" value={task.id} /> : null}

          <label className="flex flex-col gap-1 text-sm">
            <span>업무명 (WorkUnit)</span>
            <input
              name="title"
              required
              defaultValue={task?.title ?? ""}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>담당자 (Worker)</span>
            <select
              name="assigneeId"
              defaultValue={task?.assigneeId ?? ""}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            >
              <option value="">미지정</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.profile.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>상태</span>
            <select
              name="status"
              defaultValue={task?.status ?? "planned"}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>시작일</span>
              <input
                type="date"
                name="startDate"
                defaultValue={task?.startDate ?? ""}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>종료일</span>
              <input
                type="date"
                name="endDate"
                defaultValue={task?.endDate ?? ""}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span>우선순위 (낮을수록 높음)</span>
            <input
              type="number"
              name="priority"
              defaultValue={task?.priority ?? 100}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            />
          </label>

          {tags.length > 0 ? (
            <fieldset className="text-sm">
              <legend className="mb-1">태그</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      name="tagIds"
                      value={tag.id}
                      checked={selectedTags.includes(tag.id)}
                      onChange={() =>
                        setSelectedTags((prev) =>
                          prev.includes(tag.id)
                            ? prev.filter((id) => id !== tag.id)
                            : [...prev, tag.id],
                        )
                      }
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-zinc-950 px-5 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {pending ? "저장 중..." : isEdit ? "저장" : "추가"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm dark:border-zinc-700"
            >
              취소
            </button>
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="ml-auto text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                삭제
              </button>
            ) : null}
          </div>
        </form>

        {/* form 중첩 금지: 작업시간 UI는 업무 form 바깥에 둔다 */}
        {isEdit && task ? (
          <div className="mt-4">
            <WorkLogSection
              projectId={projectId}
              taskId={task.id}
              workLogs={task.workLogs}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
