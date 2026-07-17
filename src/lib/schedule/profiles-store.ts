import { createClient } from "@/lib/supabase/server";
import type { Profile } from "./types";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toProfile(data);
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toProfile);
}
