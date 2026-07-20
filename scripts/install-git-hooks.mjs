import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const hookDir = join(".git", "hooks");
const hookPath = join(hookDir, "pre-commit");
const hookScript = `#!/bin/sh
node scripts/bump-app-version.mjs --from-hook
`;

if (!existsSync(join(".git"))) {
  console.log("Git repository not found. Skipping hook install.");
  process.exit(0);
}

mkdirSync(hookDir, { recursive: true });
writeFileSync(hookPath, hookScript, "utf8");

try {
  chmodSync(hookPath, 0o755);
} catch {
  // Windows may ignore chmod; Git for Windows still runs the hook.
}

console.log("Installed git pre-commit hook for app version bump.");
