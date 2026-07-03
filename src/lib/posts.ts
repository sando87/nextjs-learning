export type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  content: string;
};

// DB 대신 사용하는 연습용 글 목록 — slug가 URL의 [slug]와 매칭됨
export const posts: Post[] = [
  {
    slug: "dynamic-routing",
    title: "동적 라우팅이란?",
    date: "2026-07-03",
    summary: "하나의 page.tsx로 여러 URL을 처리하는 방법",
    content:
      "폴더 이름을 [slug]처럼 대괄호로 감싸면 URL의 해당 부분이 변수로 전달됩니다. 예: /blog/dynamic-routing → slug = \"dynamic-routing\"",
  },
  {
    slug: "app-router-basics",
    title: "App Router 기본",
    date: "2026-07-02",
    summary: "src/app 폴더 구조와 page.tsx의 역할",
    content:
      "App Router에서는 폴더 구조가 URL 경로가 됩니다. page.tsx가 실제 화면을 렌더링하고, layout.tsx는 여러 페이지를 감싸는 공통 레이아웃입니다.",
  },
  {
    slug: "server-components",
    title: "Server Component",
    date: "2026-07-01",
    summary: "'use client' 없이 서버에서 렌더링되는 컴포넌트",
    content:
      "Server Component는 브라우저 JS 번들에 포함되지 않습니다. 데이터 fetch, DB 접근 등을 서버에서 직접 처리할 수 있어 App Router의 기본 모델입니다.",
  },
];

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

export function getAllPostSlugs(): string[] {
  return posts.map((post) => post.slug);
}
