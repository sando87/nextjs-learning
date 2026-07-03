import type { Metadata } from "next";
import Link from "next/link";
import { fetchPosts } from "@/lib/posts-api";

export const metadata: Metadata = {
  title: "Blog | nextjs-learning",
  description: "동적 라우팅 연습용 블로그 목록",
};

export default async function BlogPage() {
  const posts = await fetchPosts();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Blog
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Server Component에서{" "}
            <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
              fetch(&apos;/api/posts&apos;)
            </code>
            로 글 목록을 가져옵니다.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li
              key={post.slug}
              className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Link href={`/blog/${post.slug}`} className="group block">
                <h2 className="text-lg font-semibold text-zinc-950 group-hover:underline dark:text-zinc-50">
                  {post.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{post.date}</p>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                  {post.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
