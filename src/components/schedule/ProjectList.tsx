import Link from "next/link";
import { deleteProjectAction } from "@/app/schedule/actions";
import type { Project } from "@/lib/schedule/types";

type ProjectListProps = {
  projects: Project[];
  currentUserId: string;
};

export default function ProjectList({
  projects,
  currentUserId,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        아직 프로젝트가 없습니다. 새 프로젝트를 만들어 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {projects.map((project) => (
        <li
          key={project.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
        >
          <div>
            <Link
              href={`/schedule/${project.id}`}
              className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
            >
              {project.name}
            </Link>
            <p className="text-xs text-zinc-500">
              시작일: {project.startDate}
              {project.ownerId === currentUserId ? " · 내 프로젝트" : ""}
            </p>
          </div>
          {project.ownerId === currentUserId ? (
            <form action={deleteProjectAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                className="text-sm text-red-600 hover:underline"
              >
                삭제
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
