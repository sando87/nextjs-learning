import { removeMemberAction, updateProjectAction } from "@/app/schedule/actions";
import MemberManager from "@/components/schedule/MemberManager";
import RelativeDateSetting from "@/components/schedule/RelativeDateSetting";
import TagManager from "@/components/schedule/TagManager";
import { getProjectMembers } from "@/lib/schedule/members-store";
import { getProjectRole, requireUser } from "@/lib/schedule/permissions";
import { getProjectById } from "@/lib/schedule/projects-store";
import { getTagsByProject } from "@/lib/schedule/tags-store";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type SettingsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectSettingsPage({ params }: SettingsPageProps) {
  const { projectId } = await params;
  const user = await requireUser();
  if (!user) redirect("/login");

  const project = await getProjectById(projectId);
  if (!project) notFound();

  const role = await getProjectRole(projectId, user.id);
  if (!role) redirect("/schedule");

  const [members, tags] = await Promise.all([
    getProjectMembers(projectId),
    getTagsByProject(projectId),
  ]);

  const isOwner = role === "owner";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/schedule/${projectId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 일정 보드
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            프로젝트 설정
          </h1>
        </div>
      </div>

      {isOwner ? (
        <form action={updateProjectAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <input type="hidden" name="projectId" value={projectId} />
          <h2 className="text-sm font-semibold">프로젝트 정보</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">이름</span>
            <input
              name="name"
              defaultValue={project.name}
              required
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">시작일</span>
            <input
              type="date"
              name="startDate"
              defaultValue={project.startDate}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">근무 시작 시</span>
              <select
                name="workdayStartHour"
                defaultValue={project.workdayStartHour}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">근무 종료 시</span>
              <select
                name="workdayEndHour"
                defaultValue={project.workdayEndHour}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            전체시간 버튼이 꺼져 있을 때 일/주/월 뷰에서 하루를 표시하는
            시간 구간입니다. 시작 시가 종료 시보다 앞서야 합니다.
          </p>
          <button
            type="submit"
            className="w-fit rounded-full bg-zinc-950 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
          >
            저장
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p className="font-medium">{project.name}</p>
          <p className="text-zinc-500">시작일: {project.startDate}</p>
          <p className="text-zinc-500">
            근무시간: {String(project.workdayStartHour).padStart(2, "0")}:00–
            {project.workdayEndHour === 24
              ? "24:00"
              : `${String(project.workdayEndHour).padStart(2, "0")}:00`}
          </p>
        </div>
      )}

      <RelativeDateSetting
        projectId={projectId}
        projectStartDate={project.startDate}
      />

      <MemberManager
        projectId={projectId}
        members={members}
        isOwner={isOwner}
        removeMemberAction={removeMemberAction}
      />

      <TagManager projectId={projectId} tags={tags} />
    </main>
  );
}
