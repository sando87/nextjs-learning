/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.9",
  releasedAt: "2026-07-22",
  notes: "app/schedule/actions.ts, components/schedule/PlanGanttBar.tsx 외 12개",
  sourceHash: "4b8b35412f87",
} as const;
