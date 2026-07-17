import { redirect } from "next/navigation";
import ProjectForm from "@/components/schedule/ProjectForm";
import ProjectList from "@/components/schedule/ProjectList";
import { requireUser } from "@/lib/schedule/permissions";
import { getProjectsForUser } from "@/lib/schedule/projects-store";

export default async function SchedulePage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projects = await getProjectsForUser(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          일정 관리
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          프로젝트를 만들고 팀과 업무 일정을 관리하세요.
        </p>
      </div>

      <ProjectForm />
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          내 프로젝트
        </h2>
        <ProjectList projects={projects} currentUserId={user.id} />
      </section>
    </main>
  );
}
