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
    .select("id, message, created_at, last_viewed_at")
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

  const viewedAt = new Date().toISOString();
  const latestRow = data[0];

  if (latestRow) {
    const { error: updateError } = await supabase
      .from("health_check")
      .update({ last_viewed_at: viewedAt })
      .eq("id", latestRow.id);

    if (updateError) {
      return (
        <main className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-2xl font-semibold text-red-600">
            최신 열람시간 기록 실패
          </h1>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            {updateError.message}
          </p>
        </main>
      );
    }
  }

  const rows = data.map((row, index) =>
    index === 0 ? { ...row, last_viewed_at: viewedAt } : row,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Supabase 연결 성공
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        health_check 테이블에서 {rows.length}건을 조회했습니다.
      </p>
      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span className="font-medium">{row.message}</span>
            <dl className="mt-2 space-y-1 text-sm text-zinc-500">
              <div>
                <dt className="inline font-medium text-zinc-600 dark:text-zinc-400">
                  생성 시각:{" "}
                </dt>
                <dd className="inline">
                  <time dateTime={row.created_at}>
                    {new Date(row.created_at).toLocaleString("ko-KR")}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-600 dark:text-zinc-400">
                  최신 열람시간:{" "}
                </dt>
                <dd className="inline">
                  {row.last_viewed_at ? (
                    <time dateTime={row.last_viewed_at}>
                      {new Date(row.last_viewed_at).toLocaleString("ko-KR")}
                    </time>
                  ) : (
                    "열람 기록 없음"
                  )}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}
