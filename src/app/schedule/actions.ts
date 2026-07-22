"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addProjectMember, removeProjectMember } from "@/lib/schedule/members-store";
import {
  requireProjectMember,
  requireProjectOwner,
  requireUser,
} from "@/lib/schedule/permissions";
import { findProfileByEmail } from "@/lib/schedule/profiles-store";
import {
  createProject,
  deleteProject,
  updateProject,
} from "@/lib/schedule/projects-store";
import { createTag, deleteTag, setTaskTags } from "@/lib/schedule/tags-store";
import {
  createTask,
  deleteTask,
  reorderTask,
  setTaskParent,
  updateTask,
} from "@/lib/schedule/tasks-store";
import { toHourTimestamp } from "@/lib/schedule/work-log-utils";
import {
  createWorkLog,
  deleteWorkLog,
  updateWorkLog,
} from "@/lib/schedule/work-logs-store";
import {
  TASK_STATUSES,
  type TaskStatus,
} from "@/lib/schedule/types";

function revalidateSchedule(projectId?: string) {
  revalidatePath("/schedule");
  if (projectId) {
    revalidatePath(`/schedule/${projectId}`);
    revalidatePath(`/schedule/${projectId}/settings`);
  }
}

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const name = formData.get("name");
  const startDate = formData.get("startDate");

  if (typeof name !== "string") return;

  const date =
    typeof startDate === "string" && startDate
      ? startDate
      : new Date().toISOString().slice(0, 10);

  const project = await createProject(name, user.id, date);
  revalidateSchedule();
  redirect(`/schedule/${project.id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  if (typeof projectId !== "string") return;

  const isOwner = await requireProjectOwner(projectId, user.id);
  if (!isOwner) throw new Error("프로젝트 소유자만 삭제할 수 있습니다");

  await deleteProject(projectId);
  revalidateSchedule();
  redirect("/schedule");
}

export async function updateProjectAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const name = formData.get("name");
  const startDate = formData.get("startDate");
  const workdayStartHourRaw = formData.get("workdayStartHour");
  const workdayEndHourRaw = formData.get("workdayEndHour");

  if (typeof projectId !== "string") return;

  const isOwner = await requireProjectOwner(projectId, user.id);
  if (!isOwner) throw new Error("프로젝트 소유자만 수정할 수 있습니다");

  const workdayStartHour =
    typeof workdayStartHourRaw === "string" && workdayStartHourRaw !== ""
      ? Number(workdayStartHourRaw)
      : undefined;
  const workdayEndHour =
    typeof workdayEndHourRaw === "string" && workdayEndHourRaw !== ""
      ? Number(workdayEndHourRaw)
      : undefined;

  await updateProject(projectId, {
    name: typeof name === "string" ? name : undefined,
    startDate: typeof startDate === "string" ? startDate : undefined,
    workdayStartHour: Number.isFinite(workdayStartHour)
      ? workdayStartHour
      : undefined,
    workdayEndHour: Number.isFinite(workdayEndHour)
      ? workdayEndHour
      : undefined,
  });

  revalidateSchedule(projectId);
}

export type MemberActionState = {
  error?: string;
};

export async function addMemberAction(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const email = formData.get("email");

  if (typeof projectId !== "string" || typeof email !== "string") {
    return { error: "입력값이 올바르지 않습니다." };
  }

  const isOwner = await requireProjectOwner(projectId, user.id);
  if (!isOwner) {
    return { error: "프로젝트 소유자만 멤버를 추가할 수 있습니다." };
  }

  const profile = await findProfileByEmail(email);
  if (!profile) {
    return {
      error:
        "등록된 사용자만 추가할 수 있습니다. 상대방이 먼저 회원가입해야 합니다.",
    };
  }

  try {
    await addProjectMember(projectId, profile);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "멤버 추가에 실패했습니다.",
    };
  }

  revalidateSchedule(projectId);
  return {};
}

export async function removeMemberAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const memberId = formData.get("memberId");

  if (typeof projectId !== "string" || typeof memberId !== "string") return;

  const isOwner = await requireProjectOwner(projectId, user.id);
  if (!isOwner) throw new Error("프로젝트 소유자만 멤버를 삭제할 수 있습니다");

  await removeProjectMember(memberId);
  revalidateSchedule(projectId);
}

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const title = formData.get("title");

  if (typeof projectId !== "string" || typeof title !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 업무를 추가할 수 있습니다");

  const assigneeId = formData.get("assigneeId");
  const status = formData.get("status");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const priority = formData.get("priority");

  const task = await createTask({
    projectId,
    title,
    assigneeId:
      typeof assigneeId === "string" && assigneeId ? assigneeId : null,
    status:
      typeof status === "string" &&
      TASK_STATUSES.includes(status as TaskStatus)
        ? (status as TaskStatus)
        : "planned",
    startDate:
      typeof startDate === "string" && startDate ? startDate : null,
    endDate: typeof endDate === "string" && endDate ? endDate : null,
    priority:
      typeof priority === "string" && priority ? Number(priority) : 100,
  });

  const tagIds = formData.getAll("tagIds");
  if (tagIds.length > 0) {
    await setTaskTags(
      task.id,
      tagIds.filter((id): id is string => typeof id === "string"),
    );
  }

  revalidateSchedule(projectId);
}

export async function updateTaskAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const taskId = formData.get("taskId");

  if (typeof projectId !== "string" || typeof taskId !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 업무를 수정할 수 있습니다");

  const title = formData.get("title");
  const assigneeId = formData.get("assigneeId");
  const status = formData.get("status");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const priority = formData.get("priority");

  await updateTask(taskId, {
    title: typeof title === "string" ? title : undefined,
    assigneeId:
      assigneeId === ""
        ? null
        : typeof assigneeId === "string"
          ? assigneeId
          : undefined,
    status:
      typeof status === "string" &&
      TASK_STATUSES.includes(status as TaskStatus)
        ? (status as TaskStatus)
        : undefined,
    startDate:
      startDate === ""
        ? null
        : typeof startDate === "string"
          ? startDate
          : undefined,
    endDate:
      endDate === ""
        ? null
        : typeof endDate === "string"
          ? endDate
          : undefined,
    priority:
      typeof priority === "string" && priority ? Number(priority) : undefined,
  });

  revalidateSchedule(projectId);
}

/** 계획 일정(start_date/end_date)만 갱신. 빈 문자열이면 일정 삭제 */
export async function updateTaskDatesAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const taskId = formData.get("taskId");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (typeof projectId !== "string" || typeof taskId !== "string") return;
  if (typeof startDate !== "string" || typeof endDate !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 업무를 수정할 수 있습니다");

  // 드래그로 길이를 없애면 계획 일정 클리어
  if (!startDate && !endDate) {
    await updateTask(taskId, { startDate: null, endDate: null });
    revalidateSchedule(projectId);
    return;
  }

  if (!startDate || !endDate) return;
  if (endDate < startDate) {
    throw new Error("종료일은 시작일 이후여야 합니다");
  }

  await updateTask(taskId, { startDate, endDate });
  revalidateSchedule(projectId);
}

export async function deleteTaskAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const taskId = formData.get("taskId");

  if (typeof projectId !== "string" || typeof taskId !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 업무를 삭제할 수 있습니다");

  await deleteTask(taskId);
  revalidateSchedule(projectId);
}

export async function reorderTaskAction(input: {
  projectId: string;
  taskId: string;
  beforeId: string | null;
  afterId: string | null;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { projectId, taskId, beforeId, afterId } = input;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 업무 순서를 변경할 수 있습니다");

  await reorderTask(projectId, taskId, beforeId, afterId);
  revalidateSchedule(projectId);
}

/** Hierarchy 전용: parent_id만 변경 */
export async function setTaskParentAction(input: {
  projectId: string;
  taskId: string;
  parentId: string | null;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { projectId, taskId, parentId } = input;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) {
    throw new Error("프로젝트 멤버만 업무 상위 관계를 변경할 수 있습니다");
  }

  await setTaskParent(projectId, taskId, parentId);
  revalidateSchedule(projectId);
}

export async function createTagAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const name = formData.get("name");
  const color = formData.get("color");

  if (typeof projectId !== "string" || typeof name !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 태그를 추가할 수 있습니다");

  await createTag(
    projectId,
    name,
    typeof color === "string" && color ? color : "#71717a",
  );
  revalidateSchedule(projectId);
}

export async function deleteTagAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const tagId = formData.get("tagId");

  if (typeof projectId !== "string" || typeof tagId !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 태그를 삭제할 수 있습니다");

  await deleteTag(tagId);
  revalidateSchedule(projectId);
}

export async function setTaskTagsAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const taskId = formData.get("taskId");
  const tagIds = formData.getAll("tagIds");

  if (typeof projectId !== "string" || typeof taskId !== "string") return;

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 태그를 설정할 수 있습니다");

  await setTaskTags(
    taskId,
    tagIds.filter((id): id is string => typeof id === "string"),
  );
  revalidateSchedule(projectId);
}

export async function quickUpdateTaskAction(formData: FormData) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const taskId = formData.get("taskId");
  const field = formData.get("field");
  const value = formData.get("value");

  if (
    typeof projectId !== "string" ||
    typeof taskId !== "string" ||
    typeof field !== "string"
  ) {
    return;
  }

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) throw new Error("프로젝트 멤버만 업무를 수정할 수 있습니다");

  const updates: Parameters<typeof updateTask>[1] = {};

  if (field === "title" && typeof value === "string") {
    updates.title = value;
  } else if (field === "status" && typeof value === "string") {
    if (TASK_STATUSES.includes(value as TaskStatus)) {
      updates.status = value as TaskStatus;
    }
  } else if (field === "assigneeId") {
    updates.assigneeId =
      typeof value === "string" && value ? value : null;
  }

  await updateTask(taskId, updates);
  revalidateSchedule(projectId);
}

function parseHourField(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") return null;
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

export type WorkLogActionResult =
  | { ok: true; workLog: Awaited<ReturnType<typeof createWorkLog>> }
  | { ok: false; error: string };

export async function createWorkLogAction(
  formData: FormData,
): Promise<WorkLogActionResult> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const taskId = formData.get("taskId");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const startHour = parseHourField(formData.get("startHour"));
  const endHour = parseHourField(formData.get("endHour"));
  const note = formData.get("note");

  if (
    typeof projectId !== "string" ||
    typeof taskId !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    startHour === null ||
    endHour === null
  ) {
    return { ok: false, error: "작업시간 입력값이 올바르지 않습니다" };
  }

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) {
    return { ok: false, error: "프로젝트 멤버만 작업시간을 기록할 수 있습니다" };
  }

  try {
    const workLog = await createWorkLog({
      taskId,
      startedAt: toHourTimestamp(startDate, startHour),
      endedAt: toHourTimestamp(endDate, endHour),
      note: typeof note === "string" ? note : null,
    });
    revalidateSchedule(projectId);
    return { ok: true, workLog };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "작업시간 추가에 실패했습니다",
    };
  }
}

export async function updateWorkLogAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const workLogId = formData.get("workLogId");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const startHour = parseHourField(formData.get("startHour"));
  const endHour = parseHourField(formData.get("endHour"));
  const note = formData.get("note");

  if (
    typeof projectId !== "string" ||
    typeof workLogId !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    startHour === null ||
    endHour === null
  ) {
    return { ok: false, error: "작업시간 입력값이 올바르지 않습니다" };
  }

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) {
    return { ok: false, error: "프로젝트 멤버만 작업시간을 수정할 수 있습니다" };
  }

  try {
    await updateWorkLog(workLogId, {
      startedAt: toHourTimestamp(startDate, startHour),
      endedAt: toHourTimestamp(endDate, endHour),
      note: typeof note === "string" ? note : null,
    });
    revalidateSchedule(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "작업시간 수정에 실패했습니다",
    };
  }
}

export async function deleteWorkLogAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const projectId = formData.get("projectId");
  const workLogId = formData.get("workLogId");

  if (typeof projectId !== "string" || typeof workLogId !== "string") {
    return { ok: false, error: "작업시간 입력값이 올바르지 않습니다" };
  }

  const isMember = await requireProjectMember(projectId, user.id);
  if (!isMember) {
    return { ok: false, error: "프로젝트 멤버만 작업시간을 삭제할 수 있습니다" };
  }

  try {
    await deleteWorkLog(workLogId);
    revalidateSchedule(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "작업시간 삭제에 실패했습니다",
    };
  }
}
