import ScheduleBoard from "@/components/schedule/ScheduleBoard";
import { getProjectMembers } from "@/lib/schedule/members-store";
import { getProjectRole, requireUser } from "@/lib/schedule/permissions";
import { getProjectById } from "@/lib/schedule/projects-store";
import { getTagsByProject } from "@/lib/schedule/tags-store";
import { getTasksByProject } from "@/lib/schedule/tasks-store";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectSchedulePage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const user = await requireUser();
  if (!user) redirect("/login");

  const project = await getProjectById(projectId);
  if (!project) notFound();

  const role = await getProjectRole(projectId, user.id);
  if (!role) redirect("/schedule");

  const [tasks, members, tags] = await Promise.all([
    getTasksByProject(projectId),
    getProjectMembers(projectId),
    getTagsByProject(projectId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/schedule"
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 프로젝트 목록
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {project.name}
          </h1>
          <p className="text-sm text-zinc-500">시작일: {project.startDate}</p>
        </div>
        <Link
          href={`/schedule/${projectId}/settings`}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          설정
        </Link>
      </div>

      <ScheduleBoard
        project={project}
        tasks={tasks}
        members={members}
        tags={tags}
      />
    </main>
  );
}
