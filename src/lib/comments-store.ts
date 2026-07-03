import { promises as fs } from "fs";
import path from "path";

export type Comment = {
  id: string;
  slug: string;
  text: string;
  createdAt: string;
};

type CommentsBySlug = Record<string, Comment[]>;

const COMMENTS_FILE = path.join(process.cwd(), "data", "comments.json");

async function readComments(): Promise<CommentsBySlug> {
  try {
    const raw = await fs.readFile(COMMENTS_FILE, "utf-8");
    return JSON.parse(raw) as CommentsBySlug;
  } catch {
    return {};
  }
}

async function writeComments(comments: CommentsBySlug): Promise<void> {
  await fs.mkdir(path.dirname(COMMENTS_FILE), { recursive: true });
  await fs.writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 2), "utf-8");
}

export async function getCommentsBySlug(slug: string): Promise<Comment[]> {
  const all = await readComments();
  return all[slug] ?? [];
}

export async function addCommentToStore(
  slug: string,
  text: string,
): Promise<Comment> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Comment text is required");
  }

  const all = await readComments();
  const comment: Comment = {
    id: crypto.randomUUID(),
    slug,
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  all[slug] = [...(all[slug] ?? []), comment];
  await writeComments(all);

  return comment;
}
