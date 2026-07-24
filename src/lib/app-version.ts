/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.14",
  releasedAt: "2026-07-24",
  notes: "app/schedule/actions.ts, components/schedule/PlanGanttBar.tsx 외 15개",
  sourceHash: "7621cff7f970",
} as const;
