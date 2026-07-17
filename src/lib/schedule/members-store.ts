import { createClient } from "@/lib/supabase/server";
import { getProfilesByIds } from "@/lib/schedule/profiles-store";
import type { Profile, ProjectMember } from "./types";

type MemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

function toMember(row: MemberRow, profile: Profile): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    profile,
  };
}

export async function getProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role, joined_at")
    .eq("project_id", projectId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MemberRow[];
  const profiles = await getProfilesByIds(rows.map((r) => r.user_id));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    if (!profile) {
      throw new Error("멤버 프로필을 찾을 수 없습니다");
    }
    return toMember(row, profile);
  });
}

export async function addProjectMember(
  projectId: string,
  profile: Profile,
): Promise<ProjectMember> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: profile.id,
      role: "member",
    })
    .select("id, project_id, user_id, role, joined_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 프로젝트 멤버입니다");
    }
    throw new Error(error.message);
  }

  return toMember(data as MemberRow, profile);
}

export async function removeProjectMember(memberId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }
}
