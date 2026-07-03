import Link from "next/link";

export default function BlogNotFound() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          글을 찾을 수 없습니다
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          존재하지 않는 slug입니다. Blog 목록에서 글을 선택해 주세요.
        </p>
        <Link
          href="/blog"
          className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
        >
          Blog 목록으로
        </Link>
      </main>
    </div>
  );
}
