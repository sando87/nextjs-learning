import { createClient } from "@/lib/supabase/server";
import type { ProjectRole } from "./types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return user;
}

export async function getProjectRole(
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role as ProjectRole;
}

export async function requireProjectMember(projectId: string, userId: string) {
  const role = await getProjectRole(projectId, userId);
  return role !== null;
}

export async function requireProjectOwner(projectId: string, userId: string) {
  const role = await getProjectRole(projectId, userId);
  return role === "owner";
}
