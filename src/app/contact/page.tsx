import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | nextjs-learning",
  description: "Next.js 학습 프로젝트 연락처 페이지",
};

export default function ContactPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Contact
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          학습 중 궁금한 점이 있으면 아래 정보로 연락해 주세요.
        </p>
        <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
          <li>
            <span className="font-medium text-zinc-950 dark:text-zinc-50">
              Email:{" "}
            </span>
            tjdwn0406@gmail.com
          </li>
          <li>
            <span className="font-medium text-zinc-950 dark:text-zinc-50">
              GitHub:{" "}
            </span>
            <a
              href="https://github.com/sando87/nextjs-learning"
              className="underline hover:text-zinc-950 dark:hover:text-zinc-50"
              target="_blank"
              rel="noopener noreferrer"
            >
              sando87/nextjs-learning
            </a>
          </li>
        </ul>
      </main>
    </div>
  );
}
