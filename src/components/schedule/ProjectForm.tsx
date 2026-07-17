import { createProjectAction } from "@/app/schedule/actions";

export default function ProjectForm() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={createProjectAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        새 프로젝트
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          프로젝트 이름
        </span>
        <input
          name="name"
          required
          placeholder="프로젝트 이름"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          시작일 (타임라인 기준)
        </span>
        <input
          type="date"
          name="startDate"
          defaultValue={today}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        className="w-fit rounded-full bg-zinc-950 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-950"
      >
        프로젝트 생성
      </button>
    </form>
  );
}
