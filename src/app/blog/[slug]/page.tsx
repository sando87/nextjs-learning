import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPostSlugs, getPostBySlug } from "@/lib/posts";

type Props = {
  params: Promise<{ slug: string }>;
};

// 빌드 시 알려진 slug 페이지를 미리 생성 (선택적 학습 포인트)
export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "글을 찾을 수 없음" };
  }

  return {
    title: `${post.title} | Blog`,
    description: post.summary,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <Link
          href="/blog"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Blog 목록
        </Link>
        <article>
          <p className="text-sm text-zinc-500">{post.date}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {post.title}
          </h1>
          <p className="mt-6 leading-8 text-zinc-600 dark:text-zinc-400">
            {post.content}
          </p>
        </article>
        <p className="rounded-lg bg-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          현재 URL slug:{" "}
          <code className="font-mono font-semibold">{slug}</code>
        </p>
      </main>
    </div>
  );
}
