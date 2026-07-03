import { NextResponse } from "next/server";
import { posts } from "@/lib/posts";

export async function GET() {
  return NextResponse.json(posts);
}
