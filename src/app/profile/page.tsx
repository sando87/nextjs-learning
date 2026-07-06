import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Profile | nextjs-learning",
  description: "로그인한 사용자 프로필",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Profile
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          로그인한 사용자만 볼 수 있는 페이지입니다.
        </p>
        <dl className="space-y-3 text-zinc-600 dark:text-zinc-400">
          <div>
            <dt className="font-medium text-zinc-950 dark:text-zinc-50">
              Email
            </dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-950 dark:text-zinc-50">
              User ID
            </dt>
            <dd className="break-all font-mono text-sm">{user.id}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
