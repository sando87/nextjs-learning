import { APP_VERSION } from "@/lib/app-version";

export default function AppVersionBadge() {
  return (
    <aside
      className="mt-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="앱 버전 정보"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Deployed version
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        v{APP_VERSION.version}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {APP_VERSION.releasedAt} · {APP_VERSION.notes}
      </p>
    </aside>
  );
}
