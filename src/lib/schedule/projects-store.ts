import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WORKDAY_END_HOUR,
  DEFAULT_WORKDAY_START_HOUR,
  type Project,
} from "./types";

type ProjectRow = {
  id: string;
  name: string;
  owner_id: string;
  start_date: string;
  workday_start_hour: number | null;
  workday_end_hour: number | null;
  created_at: string;
};

const PROJECT_SELECT =
  "id, name, owner_id, start_date, workday_start_hour, workday_end_hour, created_at";

function clampWorkdayHours(
  startHour: number,
  endHour: number,
): { start: number; end: number } {
  const start = Math.max(0, Math.min(23, Math.floor(startHour)));
  const end = Math.max(1, Math.min(24, Math.floor(endHour)));
  if (start >= end) {
    return {
      start: DEFAULT_WORKDAY_START_HOUR,
      end: DEFAULT_WORKDAY_END_HOUR,
    };
  }
  return { start, end };
}

function toProject(row: ProjectRow): Project {
  const { start, end } = clampWorkdayHours(
    row.workday_start_hour ?? DEFAULT_WORKDAY_START_HOUR,
    row.workday_end_hour ?? DEFAULT_WORKDAY_END_HOUR,
  );
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    startDate: row.start_date,
    workdayStartHour: start,
    workdayEndHour: end,
    createdAt: row.created_at,
  };
}

export async function getProjectsForUser(userId: string): Promise<Project[]> {
  const supabase = await createClient();

  const { data: memberships, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const projectIds = (memberships ?? []).map((m) => m.project_id);
  if (projectIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .in("id", projectIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toProject);
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toProject(data);
}

export async function createProject(
  name: string,
  ownerId: string,
  startDate: string,
): Promise<Project> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("프로젝트 이름을 입력하세요");
  }

  const supabase = await createClient();

  // owner 멤버 추가는 DB 트리거(handle_new_project)가 처리
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ name: trimmed, owner_id: ownerId, start_date: startDate })
    .select(PROJECT_SELECT)
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  return toProject(project);
}

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    startDate?: string;
    workdayStartHour?: number;
    workdayEndHour?: number;
  },
): Promise<Project> {
  const supabase = await createClient();
  const payload: {
    name?: string;
    start_date?: string;
    workday_start_hour?: number;
    workday_end_hour?: number;
  } = {};

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      throw new Error("프로젝트 이름을 입력하세요");
    }
    payload.name = trimmed;
  }

  if (updates.startDate !== undefined) {
    payload.start_date = updates.startDate;
  }

  if (
    updates.workdayStartHour !== undefined ||
    updates.workdayEndHour !== undefined
  ) {
    const current = await getProjectById(projectId);
    if (!current) throw new Error("프로젝트를 찾을 수 없습니다");
    const { start, end } = clampWorkdayHours(
      updates.workdayStartHour ?? current.workdayStartHour,
      updates.workdayEndHour ?? current.workdayEndHour,
    );
    payload.workday_start_hour = start;
    payload.workday_end_hour = end;
  }

  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toProject(data);
}

export async function deleteProject(projectId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}
