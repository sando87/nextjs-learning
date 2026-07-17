import { createClient } from "@/lib/supabase/server";
import type { Project } from "./types";

type ProjectRow = {
  id: string;
  name: string;
  owner_id: string;
  start_date: string;
  created_at: string;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    startDate: row.start_date,
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
    .select("id, name, owner_id, start_date, created_at")
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
    .select("id, name, owner_id, start_date, created_at")
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
    .select("id, name, owner_id, start_date, created_at")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  return toProject(project);
}

export async function updateProject(
  projectId: string,
  updates: { name?: string; startDate?: string },
): Promise<Project> {
  const supabase = await createClient();
  const payload: {
    name?: string;
    start_date?: string;
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

  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .select("id, name, owner_id, start_date, created_at")
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
