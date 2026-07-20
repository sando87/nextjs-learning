import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const VERSION_FILE = "src/lib/app-version.ts";
const SOURCE_ROOT = "src";
const EXCLUDED = new Set(["src/lib/app-version.ts"]);

function runGit(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function walkSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const normalized = fullPath.replace(/\\/g, "/");

    if (EXCLUDED.has(normalized)) {
      continue;
    }

    if (statSync(fullPath).isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
      continue;
    }

    files.push(normalized);
  }

  return files;
}

function getSourceFiles() {
  const tracked = runGit(`git ls-files ${SOURCE_ROOT}/`)
    .split("\n")
    .map((file) => file.trim().replace(/\\/g, "/"))
    .filter((file) => file && !EXCLUDED.has(file));

  return tracked.length > 0 ? tracked.sort() : walkSourceFiles(SOURCE_ROOT).sort();
}

function getSourceHash() {
  const hash = createHash("sha256");

  for (const file of getSourceFiles()) {
    hash.update(file);
    hash.update(readFileSync(file));
  }

  return hash.digest("hex").slice(0, 12);
}

function parseVersionFile(content) {
  const version = content.match(/version:\s*"([^"]+)"/)?.[1] ?? "0.1.0";
  const releasedAt =
    content.match(/releasedAt:\s*"([^"]+)"/)?.[1] ??
    new Date().toISOString().slice(0, 10);
  const notes = content.match(/notes:\s*"([^"]*)"/)?.[1] ?? "자동 버전업";
  const sourceHash = content.match(/sourceHash:\s*"([^"]*)"/)?.[1] ?? "";

  return { version, releasedAt, notes, sourceHash };
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);

  if ([major, minor, patch].some(Number.isNaN)) {
    return "0.1.1";
  }

  return `${major}.${minor}.${patch + 1}`;
}

function summarizeChangedFiles(files) {
  const relevant = files
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => file.startsWith("src/") && !EXCLUDED.has(file));

  if (relevant.length === 0) {
    return "자동 버전업";
  }

  const labels = relevant.map((file) =>
    relative(SOURCE_ROOT, file).replace(/\\/g, "/"),
  );

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]}, ${labels[1]}`;
  }

  return `${labels[0]}, ${labels[1]} 외 ${labels.length - 2}개`;
}

function getChangedFiles() {
  const files = new Set();
  const patterns = [
    "git diff --name-only -- src/",
    "git diff --cached --name-only -- src/",
  ];

  for (const command of patterns) {
    for (const file of runGit(command).split("\n")) {
      const normalized = file.trim().replace(/\\/g, "/");
      if (normalized) {
        files.add(normalized);
      }
    }
  }

  return [...files];
}

function buildNotes(changedFiles) {
  if (process.env.APP_VERSION_NOTES?.trim()) {
    return process.env.APP_VERSION_NOTES.trim();
  }

  const fromArg = process.argv.find((arg) => arg.startsWith("--notes="));
  if (fromArg) {
    return fromArg.slice("--notes=".length).trim() || "자동 버전업";
  }

  return summarizeChangedFiles(changedFiles);
}

function writeVersionFile({ version, releasedAt, notes, sourceHash }) {
  const escapedNotes = notes.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const content = `/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "${version}",
  releasedAt: "${releasedAt}",
  notes: "${escapedNotes}",
  sourceHash: "${sourceHash}",
} as const;
`;

  writeFileSync(VERSION_FILE, content, "utf8");
}

function stageVersionFile() {
  runGit(`git add ${VERSION_FILE}`);
}

const force = process.argv.includes("--force");
const fromHook = process.argv.includes("--from-hook");
const currentContent = readFileSync(VERSION_FILE, "utf8");
const current = parseVersionFile(currentContent);
const nextHash = getSourceHash();

if (!force && current.sourceHash === nextHash) {
  console.log("App version unchanged (no src changes detected).");
  process.exit(0);
}

const changedFiles = getChangedFiles();
const nextVersion = current.sourceHash ? bumpPatch(current.version) : current.version;
const today = new Date().toISOString().slice(0, 10);

writeVersionFile({
  version: nextVersion,
  releasedAt: today,
  notes: buildNotes(changedFiles),
  sourceHash: nextHash,
});

console.log(`App version bumped to v${nextVersion}`);

if (fromHook) {
  stageVersionFile();
}
