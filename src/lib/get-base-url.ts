import { headers } from "next/headers";

// Server Component에서 내부 API를 fetch할 때 절대 URL이 필요함
export async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  return `${protocol}://${host}`;
}
