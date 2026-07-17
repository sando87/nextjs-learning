import { createTagAction, deleteTagAction } from "@/app/schedule/actions";
import type { Tag } from "@/lib/schedule/types";

type TagManagerProps = {
  projectId: string;
  tags: Tag[];
};

export default function TagManager({ projectId, tags }: TagManagerProps) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        태그
      </h2>

      <ul className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-700"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
            <form action={deleteTagAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="tagId" value={tag.id} />
              <button type="submit" className="text-zinc-400 hover:text-red-600">
                ×
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form action={createTagAction} className="mt-4 flex gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input
          name="name"
          required
          placeholder="태그 이름"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="color"
          type="color"
          defaultValue="#71717a"
          className="h-10 w-12 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-white dark:bg-zinc-50 dark:text-zinc-950"
        >
          추가
        </button>
      </form>
    </section>
  );
}
