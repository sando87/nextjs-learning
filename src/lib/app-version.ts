/**
 * 배포 확인용 앱 버전. src/ 변경 시 scripts/bump-app-version.mjs 가 자동 갱신합니다.
 */
export const APP_VERSION = {
  version: "0.1.20",
  releasedAt: "2026-07-24",
  notes: "app/schedule/[projectId]/settings/page.tsx, components/schedule/ScheduleBoard.tsx 외 7개",
  sourceHash: "8cdfa1d95319",
} as const;
