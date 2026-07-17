"use client";

import { useActionState } from "react";
import {
  addMemberAction,
  type MemberActionState,
} from "@/app/schedule/actions";
import type { ProjectMember } from "@/lib/schedule/types";

type MemberManagerProps = {
  projectId: string;
  members: ProjectMember[];
  isOwner: boolean;
  removeMemberAction: (formData: FormData) => Promise<void>;
};

export default function MemberManager({
  projectId,
  members,
  isOwner,
  removeMemberAction,
}: MemberManagerProps) {
  const [state, formAction, isPending] = useActionState<
    MemberActionState,
    FormData
  >(addMemberAction, {});

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        멤버
      </h2>

      <ul className="mt-3 flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div>
              <span className="font-medium">{member.profile.displayName}</span>
              <span className="ml-2 text-zinc-500">{member.profile.email}</span>
              {member.role === "owner" ? (
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                  owner
                </span>
              ) : null}
            </div>
            {isOwner && member.role !== "owner" ? (
              <form action={removeMemberAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="memberId" value={member.id} />
                <button type="submit" className="text-red-600 hover:underline">
                  제거
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form action={formAction} className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input
              name="email"
              type="email"
              required
              placeholder="이메일로 멤버 추가"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {isPending ? "추가 중..." : "추가"}
            </button>
          </div>
          {state.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
