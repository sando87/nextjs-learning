import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | nextjs-learning",
  description: "Next.js 학습 프로젝트 소개 페이지",
};

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          About
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          이 프로젝트는 Next.js App Router, TypeScript, Tailwind CSS를
          학습하기 위한 연습용 웹앱입니다.
        </p>
        <p className="leading-7 text-zinc-600 dark:text-zinc-400">
          폴더 하나가 URL 경로 하나에 대응합니다. 이 파일은{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            src/app/about/page.tsx
          </code>
          이므로{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            /about
          </code>{" "}
          경로로 접근할 수 있습니다.
        </p>
      </main>
    </div>
  );
}
