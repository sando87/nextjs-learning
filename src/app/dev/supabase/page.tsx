import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Supabase 연결 검증",
  robots: { index: false, follow: false },
};

export default async function SupabaseHealthPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_check")
    .select("id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-red-600">
          Supabase 연결 실패
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{error.message}</p>
        <p className="mt-2 text-sm text-zinc-500">
          .env.local에 NEXT_PUBLIC_SUPABASE_URL과
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정한 뒤 npm run db:push로
          마이그레이션을 적용했는지 확인하세요.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Supabase 연결 성공
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        health_check 테이블에서 {data.length}건을 조회했습니다.
      </p>
      <ul className="mt-6 space-y-3">
        {data.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span className="font-medium">{row.message}</span>
            <time
              dateTime={row.created_at}
              className="mt-1 block text-sm text-zinc-500"
            >
              {new Date(row.created_at).toLocaleString("ko-KR")}
            </time>
          </li>
        ))}
      </ul>
    </main>
  );
}
