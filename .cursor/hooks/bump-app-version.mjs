import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const input = readFileSync(0, "utf8");

let filePath = "";
try {
  const payload = JSON.parse(input);
  filePath = String(payload.file_path ?? payload.path ?? "").replace(/\\/g, "/");
} catch {
  process.exit(0);
}

if (!filePath.startsWith("src/") || filePath === "src/lib/app-version.ts") {
  process.exit(0);
}

spawnSync(process.execPath, ["scripts/bump-app-version.mjs"], {
  stdio: "inherit",
});
