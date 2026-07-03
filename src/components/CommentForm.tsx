import { addComment } from "@/app/blog/actions";

type CommentFormProps = {
  slug: string;
};

export default function CommentForm({ slug }: CommentFormProps) {
  return (
    <form action={addComment} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="comment-text" className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        댓글 작성
      </label>
      <textarea
        id="comment-text"
        name="text"
        required
        rows={3}
        placeholder="댓글을 입력하세요"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <button
        type="submit"
        className="w-fit rounded-full bg-zinc-950 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-300"
      >
        댓글 등록
      </button>
    </form>
  );
}
