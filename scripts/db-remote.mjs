import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = "kllcukynqnlekksdmuyr";

if (!password) {
  console.error("SUPABASE_DB_PASSWORD가 .env.local에 필요합니다.");
  process.exit(1);
}

const encoded = encodeURIComponent(password);
// Seoul region pooler (Dashboard → Database → Connection string과 동일)
const dbUrl = `postgresql://postgres.${projectRef}:${encoded}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`;

console.log("Applying migrations to Supabase Cloud...");
execSync(`npx supabase db push --db-url "${dbUrl}" --yes`, {
  stdio: "inherit",
  env: process.env,
});

console.log("Generating TypeScript types...");
try {
  const types = execSync(
    `npx supabase gen types typescript --db-url "${dbUrl}" --schema public`,
    { encoding: "utf8", env: process.env, stdio: ["pipe", "pipe", "pipe"] },
  );
  writeFileSync("src/lib/supabase/database.types.ts", types);
} catch {
  console.warn(
    "타입 자동 생성 실패(Docker 미설치). 기존 database.types.ts를 유지합니다.",
  );
}

console.log("Done.");
