/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.7",
  releasedAt: "2026-07-20",
  notes: "app/schedule/actions.ts, components/schedule/GanttBar.tsx 외 7개",
  sourceHash: "0ed6877fb0dd",
} as const;
