import type { Comment } from "@/lib/comments-store";

type CommentListProps = {
  comments: Comment[];
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-xs text-zinc-500">
            {comment.userId ? (
              <>
                작성자:{" "}
                <span className="break-all font-mono text-zinc-700 dark:text-zinc-300">
                  {comment.userId}
                </span>
              </>
            ) : (
              "작성자: 익명"
            )}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {comment.text}
          </p>
          <time
            dateTime={comment.createdAt}
            className="mt-2 block text-xs text-zinc-500"
          >
            {formatDate(comment.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
